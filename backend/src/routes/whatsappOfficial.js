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
            return res.sendStatus(404);
        }

        const context = tenantContext.getStore();
        const tenant = context?.tenant;

        const entry = body.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;

        if (!value) {
            return res.sendStatus(200); // Nothing to process
        }

        // ──────────────────────────────────────────────
        // INCOMING MESSAGE
        // ──────────────────────────────────────────────
        if (value.messages?.[0]) {
            const messageObj = value.messages[0];
            const contactObj = value.contacts?.[0] || null;

            const phone = messageObj.from;
            const whatsapp_id = messageObj.id;
            const contact_name = contactObj
                ? contactObj.profile.name
                : `Usuario ${phone.slice(-4)}`;
            const timestamp = new Date(parseInt(messageObj.timestamp) * 1000).toISOString();

            let messageText = '';
            let mediaUrl = null;
            let mediaType = null;
            let mimeType = null;
            let mediaId = null;

            // ── Parse by message type ──
            switch (messageObj.type) {
                case 'text':
                    messageText = messageObj.text.body;
                    break;

                case 'image':
                    mediaId = messageObj.image.id;
                    mimeType = messageObj.image.mime_type;
                    mediaType = 'image';
                    messageText = messageObj.image.caption || '📷 Imagen';
                    break;

                case 'video':
                    mediaId = messageObj.video.id;
                    mimeType = messageObj.video.mime_type;
                    mediaType = 'video';
                    messageText = messageObj.video.caption || '🎥 Video';
                    break;

                case 'audio':
                    mediaId = messageObj.audio.id;
                    mimeType = messageObj.audio.mime_type;
                    mediaType = 'audio';
                    messageText = '🎤 Audio';
                    break;

                case 'document':
                    mediaId = messageObj.document.id;
                    mimeType = messageObj.document.mime_type;
                    mediaType = 'document';
                    messageText = messageObj.document.filename || '📎 Documento';
                    break;

                case 'sticker':
                    mediaId = messageObj.sticker.id;
                    mimeType = messageObj.sticker.mime_type;
                    mediaType = 'image';
                    messageText = '🏷️ Sticker';
                    break;

                case 'location':
                    messageText = `📍 Ubicación: ${messageObj.location.latitude}, ${messageObj.location.longitude}`;
                    break;

                case 'reaction':
                    // Reaction to a previous message — store it and emit
                    console.log(`👍 [OfficialWebk] Reaction received: "${messageObj.reaction.emoji}" on msgId=${messageObj.reaction.message_id}`);
                    // TODO: update DB reaction on the target message
                    return res.sendStatus(200);

                default:
                    messageText = (() => {
                        if (messageObj.type === 'button') {
                            return messageObj.button?.text || messageObj.button?.payload || 'Button Clicked';
                        }
                        if (messageObj.type === 'interactive') {
                            if (messageObj.interactive?.type === 'button_reply') {
                                return messageObj.interactive.button_reply?.title || 'Button Clicked';
                            } else if (messageObj.interactive?.type === 'list_reply') {
                                return messageObj.interactive.list_reply?.title || 'List Option Clicked';
                            }
                            return 'Interactive Response';
                        }
                        return `[Tipo de mensaje no soportado: ${messageObj.type}]`;
                    })();
            }

            console.log(`📱 [OfficialWebk] MSG from: ${phone} | Name: ${contact_name} | Type: ${messageObj.type} | "${messageText.substring(0, 40)}"`);

            // ── Avoid duplicate processing ──
            const exists = await messageService.existsByWhatsappId(whatsapp_id);
            if (exists) {
                console.log(`⏭️ [OfficialWebk] Duplicate message ${whatsapp_id}, skipping.`);
                return res.sendStatus(200);
            }

            // ── Download incoming media from Meta servers ──
            if (mediaId && tenant) {
                const officialService = require('../services/whatsappOfficialService');
                const localUrl = await officialService.downloadMedia(mediaId, tenant.slug, mimeType);
                if (localUrl) {
                    mediaUrl = localUrl;
                    console.log(`📦 [OfficialWebk] Media saved locally: ${localUrl}`);
                } else {
                    // Fallback: store the meta media ID prefixed so frontend knows to handle it
                    mediaUrl = `meta:${mediaId}`;
                    console.warn(`⚠️ [OfficialWebk] Media download failed — storing meta ID as fallback`);
                }
            }

            const dbPhone = normalizePhone(phone);

            // ── Get or create conversation ──
            let conversation = await conversationService.getByPhone(dbPhone);
            let isNewConversation = false;

            if (!conversation) {
                conversation = await conversationService.upsert(dbPhone, contact_name, 'whatsapp_official');
                isNewConversation = true;
            } else if (!conversation.contact_name || conversation.contact_name === `Usuario ${dbPhone.slice(-4)}`) {
                await conversationService.updateContactName(dbPhone, contact_name);
            }

            const currentState = conversation?.conversation_state || 'ai_active';
            const shouldActivateAI = conversation.ai_enabled !== false;

            // ── Save message to database ──
            await messageService.create({
                phone: dbPhone,
                sender: 'user',
                text: messageText,
                whatsappId: whatsapp_id,
                mediaType,
                mediaUrl
            });

            // ── Update conversation counters ──
            await conversationService.updateLastMessage(dbPhone, messageText);
            await conversationService.incrementUnread(dbPhone);

            // ── Mark as read via Official API (sends read receipt to WhatsApp) ──
            try {
                const officialService = require('../services/whatsappOfficialService');
                await officialService.markAsRead(dbPhone, whatsapp_id);
            } catch (readErr) {
                console.warn(`⚠️ [OfficialWebk] Could not send read receipt: ${readErr.message}`);
            }

            // ── Forward to n8n for AI processing if enabled ──
            if (shouldActivateAI && currentState === 'ai_active') {
                try {
                    if (tenant?.n8n_webhook_url) {
                        console.log(`🤖 [OfficialWebk] Forwarding to n8n for AI...`);
                        await n8nService.triggerAIProcessing({
                            phone: dbPhone,
                            text: messageText,
                            contactName: contact_name,
                            mediaType,
                            mediaUrl
                        });
                    } else {
                        console.warn(`⚠️ [OfficialWebk] No n8n_webhook_url for tenant ${tenant?.slug}`);
                    }
                } catch (n8nErr) {
                    console.error('❌ [OfficialWebk] Error forwarding to n8n:', n8nErr.message);
                }
            }

            // ── Emit to frontend via Socket.IO ──
            emitToConversation(dbPhone, 'new-message', {
                phone: dbPhone,
                contact_name,
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

        // ──────────────────────────────────────────────
        // MESSAGE STATUS UPDATE (sent/delivered/read)
        // ──────────────────────────────────────────────
        } else if (value.statuses?.[0]) {
            const statusObj = value.statuses[0];
            console.log(`📊 [OfficialWebk] Status: ${statusObj.id} → ${statusObj.status} for ${statusObj.recipient_id}`);

            await messageService.updateStatus(statusObj.id, statusObj.status);

            // Emit status to frontend so tick icons update in real time
            if (io) {
                const context = tenantContext.getStore();
                const tenantSlug = context?.tenant?.slug;
                if (tenantSlug) {
                    io.to(`tenant:${tenantSlug}:conversations:list`).emit('message-status-update', {
                        whatsapp_id: statusObj.id,
                        status: statusObj.status,
                        phone: statusObj.recipient_id
                    });
                }
            }
        }

        // Always respond 200 OK to Meta
        res.sendStatus(200);

    } catch (error) {
        console.error('❌ [OfficialWebk] Error inside webhook:', error);
        res.sendStatus(500);
    }
});

module.exports = { router, setSocketIO };
