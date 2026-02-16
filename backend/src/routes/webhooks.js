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

const evolutionService = require('../services/evolutionService');

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
    console.log('--- NUEVO WEBHOOK DE N8N ---');
    console.log('📦 Body:', JSON.stringify(req.body));
    console.log('---------------------------');

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
        console.error('❌ Error: El webhook no incluyó un número de teléfono (phone)');
        return res.status(400).json({ error: 'Phone number required' });
    }

    // --- NORMALIZACIÓN DE TELÉFONO ---
    // Evolution ofrece el número puro (57304...). El dashboard usa +57304...
    const purePhone = phone.replace(/\D/g, ''); // 573043821239
    const dbPhone = purePhone.startsWith('57') ? `+${purePhone}` : purePhone; // +573043821239

    console.log(`📱 [WEBHOOK] Phone Original: ${phone} | Pure: ${purePhone} | DB: ${dbPhone}`);
    console.log(`👤 [WEBHOOK] Sender Type: ${sender_type}`);

    // Check for duplicate
    if (whatsapp_id) {
        const exists = await messageService.existsByWhatsappId(whatsapp_id);
        if (exists) {
            console.log(`⏭️ Duplicate message: ${whatsapp_id}, saltando save.`);
            return res.json({ success: true, duplicate: true });
        }
    }

    // Get or create conversation
    let conversation = await conversationService.getByPhone(dbPhone);

    let isNewConversation = false;
    if (!conversation) {
        console.log(`➕ Creando nueva conversación para ${dbPhone}`);
        conversation = await conversationService.upsert(dbPhone, contact_name || `Usuario ${dbPhone.slice(-4)}`);
        isNewConversation = true;
    }

    const currentState = conversation?.conversation_state || 'ai_active';
    const shouldActivateAI = conversation.ai_enabled !== false;

    // Save message
    await messageService.create({
        phone: dbPhone,
        sender: sender_type,
        text: message,
        whatsappId: whatsapp_id,
        mediaType: media_type,
        mediaUrl: media_url
    });

    // Update conversation
    await conversationService.updateLastMessage(dbPhone, message);

    // Only increment unread for user messages
    const isBot = sender_type === 'bot' || sender_type === 'ai';
    const isAgent = sender_type === 'agent';

    if (!isBot && !isAgent) {
        await conversationService.incrementUnread(dbPhone);
    }

    // --- SEND VIA WHATSAPP (EVOLUTION API) ---
    // Solo enviamos si NO es un mensaje que viene del usuario (es decir, viene de n8n o agente)
    if (isBot || isAgent) {
        console.log(`📤 Remitiendo respuesta (${sender_type}) a WhatsApp via Evolution API [Num: ${purePhone}]...`);
        try {
            let result;
            if (media_type && media_url) {
                result = await evolutionService.sendMedia(purePhone, media_url, media_type, message);
            } else {
                result = await evolutionService.sendText(purePhone, message);
            }

            if (result && result.success) {
                console.log(`✅ ¡ÉXITO! Evolution API entregó el mensaje a ${purePhone}`);
            } else {
                console.error(`❌ ERROR de Evolution API para ${purePhone}:`, result ? result.error : 'Sin respuesta');
            }
        } catch (evoError) {
            console.error('❌ ERROR CRÍTICO contactando Evolution API:', evoError.message);
        }
    }

    // Emit to frontend (OPTIMIZED: uses rooms)
    emitToConversation(dbPhone, 'new-message', {
        phone: dbPhone,
        contact_name: conversation?.contact_name || contact_name || `Usuario ${dbPhone.slice(-4)}`,
        message,
        whatsapp_id,
        sender_type,
        media_type,
        media_url,
        sender_name: isBot ? 'Inteligencia Artificial' : (isAgent ? 'Agente' : (contact_name || `Usuario ${dbPhone.slice(-4)}`)),
        unread: (isBot || isAgent) ? 0 : 1,
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

