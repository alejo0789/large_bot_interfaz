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

const { pool } = require('../config/database');
const path = require('path');
const fs = require('fs');

// Socket.IO instance
let io = null;
const setSocketIO = (socketIO) => { io = socketIO; };

/**
 * Emit message to specific conversation room only
 * This reduces network traffic significantly for 2000+ conversations
 */
const emitToConversation = (phone, event, data) => {
    if (!io) return;

    // Normalizar para asegurar entrega a ambos tipos de salas
    const purePhone = phone.replace(/\D/g, '');
    const dbPhone = purePhone.startsWith('57') ? `+${purePhone}` : purePhone;

    // Emitir a la sala con + (formato DB)
    io.to(`conversation:${dbPhone}`).emit(event, data);

    // Emitir a la sala sin + (formato puro, común en frontend antiguo/específico)
    if (dbPhone !== purePhone) {
        io.to(`conversation:${purePhone}`).emit(event, data);
    }

    // Emit to global conversations room (for updating conversation list)
    io.to('conversations:list').emit('conversation-updated', {
        phone: dbPhone,
        lastMessage: data.message,
        timestamp: data.timestamp,
        contact_name: data.contact_name,
        unread: data.unread !== undefined ? data.unread : 1,
        isNew: data.isNew || false
    });

    // Also emit globally for backward compatibility
    io.emit('new-message', data);
};

// Receive message from N8N (WhatsApp incoming)
router.post('/receive-message', asyncHandler(async (req, res) => {
    console.log('--- NUEVO WEBHOOK DE N8N ---');
    console.log('📦 Body:', JSON.stringify(req.body));
    console.log('---------------------------');

    let {
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

    // --- NORMALIZACIÓN DE TELÉFONO (MOVIDO AL INICIO) ---
    // Evolution ofrece el número puro (57304...). El dashboard usa +57304...
    const purePhone = phone.replace(/\D/g, ''); // 573043821239
    const dbPhone = purePhone.startsWith('57') ? `+${purePhone}` : purePhone; // +573043821239

    const isBot = sender_type === 'bot' || sender_type === 'ai';
    const isAgent = sender_type === 'agent';

    // --- DETECCIÓN AUTOMÁTICA DE IMÁGENES POR ID ---
    // Si es un mensaje del bot y tiene el tag [ID: uuid], buscamos la imagen
    if ((isBot || isAgent) && message) {
        console.log(`🤖 AI Message Content (Raw): "${message}"`);
        // Regex flexible para ID con o sin corchetes
        // Match [ID: uuid] OR ID: uuid
        const idMatch = message.match(/(?:\[ID:\s*|ID:\s*)([0-9a-fA-F-]{36})(?:\])?/i);
        if (idMatch) {
            const contextId = idMatch[1];

            // LIMPIEZA INMEDIATA: Si detectamos un ID, lo borramos del mensaje VISIBLE
            // Independientemente de si encontramos la imagen o no, el usuario no debe ver el código
            // Regex match: [ID: uuid] OR ID: uuid (flexible)
            message = message.replace(/(?:\[ID:\s*|ID:\s*)[0-9a-fA-F-]{36}(?:\])?/gi, '').trim();

            console.log(`🔍 Detectado ID de contexto: ${contextId}. Buscando imagen...`);

            try {
                const result = await pool.query('SELECT media_url, type FROM ai_knowledge WHERE id = $1', [contextId]);
                if (result.rows.length > 0 && result.rows[0].media_url) {
                    const candidateUrl = result.rows[0].media_url;

                    // --- VALIDACIÓN DE DUPLICADOS EN LA CONVERSACIÓN ---
                    // Verificar si ya enviamos esta misma URL a este usuario en las últimas 24 horas
                    const duplicateCheck = await pool.query(
                        `SELECT id FROM messages 
                         WHERE conversation_phone = $1 
                         AND media_url = $2 
                         AND (sender = 'bot' OR sender = 'ai') 
                         AND timestamp > NOW() - INTERVAL '12 hours'
                         LIMIT 1`,
                        [dbPhone, candidateUrl]
                    );

                    if (duplicateCheck.rows.length > 0) {
                        console.log(`🚫 Imagen ya enviada recientemente a ${dbPhone}. Omitiendo envío duplicado.`);
                        // NO asignamos media_url, así que solo se enviará el texto
                    } else {
                        media_url = candidateUrl;

                        // Si encontramos el tipo en la BD, lo usamos
                        if (result.rows[0].type && result.rows[0].type !== 'text') {
                            media_type = result.rows[0].type;
                        }

                        // Si la URL es local, construir la URL absoluta para Evolution API
                        if (media_url.startsWith('/')) {
                            const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
                            media_url = `${baseUrl}${media_url}`;
                        }
                        console.log(`🖼️ Imagen NUEVA encontrada vinculada al ID: ${media_url} (Tipo DB: ${result.rows[0].type})`);
                    }
                }
            } catch (dbError) {
                console.error('❌ Error buscando media_url por ID:', dbError);
            }
        } else {
            console.log('⚠️ No ID match found in message:', message.substring(0, 50) + '...');
        }
    }

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

    // --- NORMALIZACIÓN DE MEDIA TYPE ---
    // Si viene como 'text' o vacío, intentar inferir por extensión ANTES DE GUARDAR
    let normalizedMediaType = (media_type || '').trim().toLowerCase();

    if (media_url && (!normalizedMediaType || normalizedMediaType === 'text')) {
        if (media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) normalizedMediaType = 'image';
        else if (media_url.match(/\.(mp4|avi|mov)$/i)) normalizedMediaType = 'video';
        else if (media_url.match(/\.(mp3|ogg|wav)$/i)) normalizedMediaType = 'audio';
        else if (media_url.match(/\.(pdf|doc|docx)$/i)) normalizedMediaType = 'document';
        else normalizedMediaType = 'image'; // Default a imagen si tiene URL
    }

    // Si validamos que es imagen, actualizamos la variable principal
    if (normalizedMediaType && normalizedMediaType !== 'text') {
        media_type = normalizedMediaType;
    }

    // Save message
    await messageService.create({
        phone: dbPhone,
        sender: sender_type,
        text: message,
        whatsappId: whatsapp_id,
        mediaType: media_type, // Ahora guarda 'image' si detectó extensión
        mediaUrl: media_url
    });

    // Update conversation
    await conversationService.updateLastMessage(dbPhone, message);

    if (!isBot && !isAgent) {
        await conversationService.incrementUnread(dbPhone);
    }

    // --- SEND VIA WHATSAPP (EVOLUTION API) ---
    // Solo enviamos si NO es un mensaje que viene del usuario (es decir, viene de n8n o agente)
    if (isBot || isAgent) {
        console.log(`📤 Remitiendo respuesta (${sender_type}) a WhatsApp via Evolution API [Num: ${purePhone}]...`);
        try {
            let result;

            if (media_url) {
                // Si n8n o el sistema envían una URL, la usamos directamente
                // Normalizar tipo de medio
                let type = (media_type || '').trim().toLowerCase();

                // Si viene como 'text' o vacío, intentar inferir por extensión
                if (!type || type === 'text') {
                    if (media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) type = 'image';
                    else if (media_url.match(/\.(mp4|avi|mov)$/i)) type = 'video';
                    else if (media_url.match(/\.(mp3|ogg|wav)$/i)) type = 'audio';
                    else if (media_url.match(/\.(pdf|doc|docx)$/i)) type = 'document';
                    else type = 'image'; // Default a imagen si tiene URL pero no extensión conocida (más probable)
                }

                console.log(`🖼️ Enviando multimedia: ${media_url} (Tipo Original: ${media_type}, Final: ${type})`);
                result = await evolutionService.sendMedia(purePhone, media_url, type, message);
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

