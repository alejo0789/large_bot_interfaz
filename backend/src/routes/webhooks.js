/**
 * Webhook Routes
 * Handles incoming messages from N8N/WhatsApp
 */
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const messageService = require('../services/messageService');
const conversationService = require('../services/conversationService');

// Socket.IO instance
let io = null;
const setSocketIO = (socketIO) => { io = socketIO; };

// Receive message from N8N (WhatsApp incoming)
router.post('/receive-message', asyncHandler(async (req, res) => {
    console.log('📨 Webhook received:', JSON.stringify(req.body).substring(0, 200));

    const {
        phone,
        contact_name,
        message,
        whatsapp_id,
        sender_type = 'user',
        timestamp,
        media_type,
        media_url
    } = req.body;

    if (!phone) {
        return res.status(400).json({ error: 'Phone number required' });
    }

    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, '').replace(/^57/, '+57');

    // Check for duplicate
    if (whatsapp_id) {
        const exists = await messageService.existsByWhatsappId(whatsapp_id);
        if (exists) {
            console.log(`⚠️ Duplicate message: ${whatsapp_id}`);
            return res.json({ success: true, duplicate: true });
        }
    }

    // Get or create conversation
    let conversation = await conversationService.getByPhone(cleanPhone);
    const currentState = conversation?.conversation_state || 'ai_active';
    const shouldActivateAI = !conversation || conversation.ai_enabled !== false;

    if (!conversation) {
        console.log(`➕ Creating new conversation for ${cleanPhone}`);
        await conversationService.upsert(cleanPhone, contact_name || `Usuario ${cleanPhone.slice(-4)}`);
    }

    // Save message
    await messageService.create({
        phone: cleanPhone,
        sender: sender_type,
        text: message,
        whatsappId: whatsapp_id,
        mediaType: media_type,
        mediaUrl: media_url
    });

    // Update conversation
    await conversationService.updateLastMessage(cleanPhone, message);
    await conversationService.incrementUnread(cleanPhone);

    // Emit to frontend
    if (io) {
        io.emit('new-message', {
            phone: cleanPhone,
            contact_name: contact_name || `Usuario ${cleanPhone.slice(-4)}`,
            message,
            whatsapp_id,
            sender_type,
            media_type,
            media_url,
            timestamp: timestamp || new Date().toISOString(),
            conversation_state: currentState,
            ai_enabled: shouldActivateAI
        });
    }

    res.json({
        success: true,
        message: 'Mensaje procesado',
        ai_should_respond: shouldActivateAI,
        conversation_state: currentState
    });
}));

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = { router, setSocketIO };
