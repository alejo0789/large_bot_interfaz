/**
 * TikTok Business Messaging Webhook Routes
 * Handles incoming direct messages from TikTok Business API
 */
const express = require('express');
const router = express.Router();
const messageService = require('../services/messageService');
const conversationService = require('../services/conversationService');
const { pool } = require('../config/database');
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

    // Emit to conversation room
    io.to(`tenant:${tenantSlug}:conversation:${phone}`).emit(event, data);

    // Emit to conversations list room
    io.to(`tenant:${tenantSlug}:conversations:list`).emit('conversation-updated', {
        phone: phone,
        lastMessage: data.message,
        timestamp: data.timestamp,
        contact_name: data.contact_name,
        unread: data.unread !== undefined ? data.unread : 1,
        isNew: data.isNew || false,
        channel: 'tiktok'
    });
};

/**
 * Verification endpoint (TikTok pings or challenges)
 */
router.get('/', (req, res) => {
    console.log('📥 [TikTok Webhook GET Verification]:', req.query);
    const challenge = req.query.challenge || req.query['hub.challenge'];
    if (challenge) {
        return res.status(200).send(challenge);
    }
    res.status(200).json({ status: 'ok', message: 'TikTok Webhook Endpoint Active' });
});

/**
 * Incoming message webhook
 */
router.post('/', async (req, res) => {
    try {
        const body = req.body;
        console.log('📥 [TikTok Webhook POST]:', JSON.stringify(body, null, 2));

        // Handle verification challenge in POST if sent by TikTok
        if (body.challenge) {
            return res.status(200).json({ challenge: body.challenge });
        }

        const context = tenantContext.getStore();
        const tenant = context?.tenant;

        // Parse message details from TikTok payload
        // TikTok payloads typically have:
        // { event: "DIRECT_MESSAGE", user_openid, content: { conversation_id, message: { text, ... } } }
        // or direct message wrapper
        const event = body.event || body.event_type;
        const content = body.content || body.data || body;
        const convId = content?.conversation_id || body.conversation_id || body.user_openid;
        
        let messageText = '';
        let messageId = `tt_msg_${Date.now()}`;
        let senderName = 'Usuario TikTok';

        if (content?.message) {
            messageId = content.message.message_id || messageId;
            messageText = content.message.text?.text || content.message.text || content.message.content || '';
        } else if (body.text) {
            messageText = typeof body.text === 'object' ? body.text.text : body.text;
        }

        if (convId && messageText) {
            const phoneIdentifier = `tiktok_${convId}`;
            const timestamp = new Date().toISOString();

            console.log(`💬 [TikTok] Nuevo mensaje de ${phoneIdentifier}: "${messageText}" (Sede: ${tenant?.slug || 'default'})`);

            // 1. Upsert conversation with channel 'tiktok'
            await conversationService.upsert(
                phoneIdentifier,
                senderName,
                null,
                false
            );

            // Update channel to tiktok
            await pool.query(
                `UPDATE conversations SET channel = 'tiktok', updated_at = NOW() WHERE phone = $1`,
                [phoneIdentifier]
            );

            // 2. Save incoming message
            const savedMsg = await messageService.save({
                whatsappId: messageId,
                conversationPhone: phoneIdentifier,
                sender: 'user',
                textContent: messageText,
                mediaType: null,
                mediaUrl: null,
                status: 'received',
                timestamp: timestamp
            });

            // 3. Update conversation last message
            await conversationService.updateLastMessage(phoneIdentifier, messageText, false);

            // 4. Emit via Socket.IO to the frontend
            emitToConversation(phoneIdentifier, 'new-message', {
                message: {
                    id: savedMsg.id,
                    whatsapp_id: messageId,
                    conversation_phone: phoneIdentifier,
                    sender: 'user',
                    text_content: messageText,
                    status: 'received',
                    timestamp: timestamp
                },
                contact_name: senderName,
                timestamp: timestamp,
                unread: 1,
                channel: 'tiktok'
            });
        }

        // Always acknowledge with 200 OK
        return res.status(200).json({ code: 0, message: 'OK' });
    } catch (error) {
        console.error('❌ [TikTok Webhook Error]:', error);
        // Always return 200 to TikTok to prevent retry spam
        return res.status(200).json({ code: 0, message: 'Received with errors' });
    }
});

module.exports = {
    router,
    setSocketIO
};
