/**
 * Webhook Routes
 * Handles incoming messages from N8N/WhatsApp
 * OPTIMIZED: Uses Socket.IO rooms for targeted message delivery
 */
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const messageService = require('../services/messageService');
const conversationService = require('../services/conversationService');

// Socket.IO instance
let io = null;
const setSocketIO = (socketIO) => { io = socketIO; };

/**
 * Emit message to specific conversation room only
 * This reduces network traffic significantly for 2000+ conversations
 */
const emitToConversation = (phone, event, data) => {
    if (!io) return;

    // Emit to specific conversation room (clients viewing this chat)
    io.to(`conversation:${phone}`).emit(event, data);

    // Emit to global conversations room (for updating conversation list)
    io.to('conversations:list').emit('conversation-updated', {
        phone,
        lastMessage: data.message,
        timestamp: data.timestamp,
        contact_name: data.contact_name, // Added for new conversations
        unread: data.unread !== undefined ? data.unread : 1,
        isNew: data.isNew || false
    });

    // Also emit globally for backward compatibility (will be deprecated)
    io.emit('new-message', data);
};

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

    let isNewConversation = false;
    if (!conversation) {
        console.log(`➕ Creating new conversation for ${cleanPhone}`);
        conversation = await conversationService.upsert(cleanPhone, contact_name || `Usuario ${cleanPhone.slice(-4)}`);
        isNewConversation = true;
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

    // Only increment unread for user messages
    const isAgent = sender_type === 'agent';
    if (!isAgent) {
        await conversationService.incrementUnread(cleanPhone);
    }

    // Emit to frontend (OPTIMIZED: uses rooms)
    emitToConversation(cleanPhone, 'new-message', {
        phone: cleanPhone,
        contact_name: conversation?.contact_name || contact_name || `Usuario ${cleanPhone.slice(-4)}`,
        message,
        whatsapp_id,
        sender_type,
        media_type,
        media_url,
        sender_name: contact_name || `Usuario ${cleanPhone.slice(-4)}`,
        unread: isAgent ? 0 : 1,
        timestamp: timestamp || new Date().toISOString(),
        conversation_state: currentState,
        ai_enabled: shouldActivateAI,
        isNew: isNewConversation
    });

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

