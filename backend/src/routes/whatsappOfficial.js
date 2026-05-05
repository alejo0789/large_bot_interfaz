/**
 * Official WhatsApp API Webhook Routes
 * Handles incoming messages from Meta Graph API
 */
const express = require('express');
const router = express.Router();
const messageService = require('../services/messageService');
const conversationService = require('../services/conversationService');
const whatsappFactory = require('../services/whatsappFactory');
const n8nService = require('../services/n8nService');
const { normalizePhone, getPureDigits } = require('../utils/phoneUtils');
const { tenantContext } = require('../utils/tenantContext');

let io = null;
const setSocketIO = (socketIO) => { io = socketIO; };

// Helper to emit events - MT-AWARE
const emitToConversation = (phone, event, data) => {
    if (!io) return;

    const context = tenantContext.getStore();
    const tenantSlug = context?.tenant?.slug;

    if (!tenantSlug) {
        console.warn('⚠️ emitToConversation called without tenant context');
        return;
    }

    const dbPhone = normalizePhone(phone);
    const purePhone = getPureDigits(phone);

    io.to(`tenant:${tenantSlug}:conversation:${purePhone}`).emit(event, data);

    io.to(`tenant:${tenantSlug}:conversations:list`).emit('conversation-updated', {
        phone: dbPhone,
        lastMessage: data.message,
        timestamp: data.timestamp,
        contact_name: data.contact_name,
        unread: data.unread !== undefined ? data.unread : 1,
        isNew: data.isNew || false
    });
};

/**
 * Validates the webhook with Meta (Challenge validation)
 */
router.get('/', (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        const context = tenantContext.getStore();
        const tenant = context?.tenant;

        if (!tenant || !tenant.wa_verify_token) {
            console.warn('⚠️ Webhook verification failed: Tenant or wa_verify_token not found');
            return res.sendStatus(403);
        }

        if (mode && token) {
            if (mode === 'subscribe' && token === tenant.wa_verify_token) {
                console.log(`✅ Webhook verified successfully for tenant ${tenant.slug}`);
                return res.status(200).send(challenge);
            } else {
                return res.sendStatus(403);
            }
        }

        res.status(400).send('Bad Request');
    } catch (error) {
        console.error('❌ Webhook verification error:', error);
        res.sendStatus(500);
    }
});

/**
 * Handles incoming messages/statuses from Meta Official API
 */
router.post('/', async (req, res) => {
    try {
        let body = req.body;

        // Check if this is an event from a WhatsApp API
        if (body.object !== 'whatsapp_business_account') {
            return res.sendStatus(404); // Not a WhatsApp API event
        }

        const context = tenantContext.getStore();
        const tenant = context?.tenant;

        // Iterate through all entries and their changes
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
            const value = body.entry[0].changes[0].value;
            const messageObj = value.messages[0];
            const contactObj = value.contacts && value.contacts[0] ? value.contacts[0] : null;

            // Extract relevant data
            const phone = messageObj.from;
            const whatsapp_id = messageObj.id;
            const contact_name = contactObj ? contactObj.profile.name : `Usuario ${phone.slice(-4)}`;
            const timestamp = new Date(parseInt(messageObj.timestamp) * 1000).toISOString();

            let messageText = '';
            let mediaUrl = null;
            let mediaType = null;

            // Determine message type
            if (messageObj.type === 'text') {
                messageText = messageObj.text.body;
            } else if (messageObj.type === 'image') {
                mediaUrl = messageObj.image.id; // Usually requires another API call to get actual URL, but we will store ID for now
                mediaType = 'image';
                messageText = messageObj.image.caption || '📷 Imagen';
            } else if (messageObj.type === 'video') {
                mediaUrl = messageObj.video.id;
                mediaType = 'video';
                messageText = messageObj.video.caption || '🎥 Video';
            } else if (messageObj.type === 'document') {
                mediaUrl = messageObj.document.id;
                mediaType = 'document';
                messageText = messageObj.document.filename || '📎 Documento';
            } else if (messageObj.type === 'audio') {
                mediaUrl = messageObj.audio.id;
                mediaType = 'audio';
                messageText = '🎤 Audio';
            } else {
                messageText = `[Mensaje tipo: ${messageObj.type} no soportado temporalmente]`;
            }

            console.log(`📱 [OfficialWebk] MSG from: ${phone} | Name: ${contact_name} | Type: ${messageObj.type} | Text: ${messageText.substring(0, 30)}`);

            const dbPhone = normalizePhone(phone);

            // Avoid duplicate processing
            const exists = await messageService.existsByWhatsappId(whatsapp_id);
            if (exists) {
                console.log(`⏭️ [OfficialWebk] Duplicate message: ${whatsapp_id}, skipping save.`);
                return res.sendStatus(200);
            }

            // Get or create conversation
            let conversation = await conversationService.getByPhone(dbPhone);
            let isNewConversation = false;

            if (!conversation) {
                conversation = await conversationService.upsert(dbPhone, contact_name);
                isNewConversation = true;
            } else if (conversation.contact_name === `Usuario ${dbPhone.slice(-4)}` || !conversation.contact_name) {
                await conversationService.updateContactName(dbPhone, contact_name);
            }

            const currentState = conversation?.conversation_state || 'ai_active';
            const shouldActivateAI = conversation.ai_enabled !== false;

            // Save message to database
            await messageService.create({
                phone: dbPhone,
                sender: 'user', // From user
                text: messageText,
                whatsappId: whatsapp_id,
                mediaType: mediaType,
                mediaUrl: mediaUrl // NOTE: For Official API, you often have to exchange media ID for URL
            });

            // Update conversation states
            await conversationService.updateLastMessage(dbPhone, messageText);
            await conversationService.incrementUnread(dbPhone);

            // If AI is enabled and active, forward to n8n
            if (shouldActivateAI && currentState === 'ai_active') {
                // Determine if we forward to webhook directly using n8nService
                console.log(`🤖 Forwarding message to n8n for AI processing...`);
                try {
                    // This uses your custom n8n integration structure
                    if (tenant && tenant.n8n_webhook_url) {
                        await n8nService.triggerAIProcessing({
                            phone: dbPhone,
                            text: messageText,
                            contactName: contact_name,
                            mediaType: mediaType,
                            mediaUrl: mediaUrl
                        });
                    } else {
                        console.warn(`⚠️ No n8n_webhook_url defined for tenant ${tenant?.slug}`);
                    }
                } catch (err) {
                    console.error('❌ Error forwarding to n8n:', err.message);
                }
            }

            // Emit to frontend via Socket.IO
            emitToConversation(dbPhone, 'new-message', {
                phone: dbPhone,
                contact_name: contact_name,
                message: messageText,
                whatsapp_id,
                sender_type: 'user',
                media_type: mediaType,
                media_url: mediaUrl,
                sender_name: contact_name,
                unread: 1,
                timestamp,
                conversation_state: currentState,
                ai_enabled: shouldActivateAI,
                isNew: isNewConversation
            });

        } else if (body.entry && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value.statuses && body.entry[0].changes[0].value.statuses[0]) {
            // Handle message status updates (sent, delivered, read)
            const statusObj = body.entry[0].changes[0].value.statuses[0];
            console.log(`📊 [OfficialWebk] Status update: ${statusObj.id} -> ${statusObj.status} for ${statusObj.recipient_id}`);

            await messageService.updateStatus(statusObj.id, statusObj.status);

            // Note: Normally we'd also emit a status update to socket so frontend updates read ticks
        }

        // Return a '200 OK' response to all requests
        res.sendStatus(200);

    } catch (error) {
        console.error('❌ [OfficialWebk] Error inside webhook:', error);
        res.sendStatus(500);
    }
});

module.exports = { router, setSocketIO };
