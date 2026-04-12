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

const evolutionService = require('../services/whatsappFactory');
const { normalizePhone, getPureDigits } = require('../utils/phoneUtils');


const { pool } = require('../config/database');
const path = require('path');
const fs = require('fs');
const { tenantContext } = require('../utils/tenantContext');

// Socket.IO instance
let io = null;
const setSocketIO = (socketIO) => { io = socketIO; };

/**
 * Emit message to specific conversation room only
 * MT-AWARE: Uses tenant-scoped rooms
 */
const emitToConversation = (phone, event, data) => {
    if (!io) return;

    // Get tenant from context
    const context = tenantContext.getStore();
    const tenantSlug = context?.tenant?.slug;

    if (!tenantSlug) {
        console.warn('⚠️ emitToConversation called without tenant context');
        return;
    }

    // Normalizar para asegurar entrega a ambos tipos de salas
    const dbPhone = normalizePhone(phone);
    const purePhone = getPureDigits(phone);

    // Emitir a la sala de conversación (tenant-scoped)
    io.to(`tenant:${tenantSlug}:conversation:${purePhone}`).emit(event, data);

    // Emit to tenant-specific conversations list room
    io.to(`tenant:${tenantSlug}:conversations:list`).emit('conversation-updated', {
        phone: dbPhone,
        lastMessage: data.message,
        timestamp: data.timestamp,
        contact_name: data.contact_name,
        unread: data.unread !== undefined ? data.unread : 1,
        isNew: data.isNew || false
    });
};

// Receive message from N8N (WhatsApp incoming)
router.post('/receive-message', asyncHandler(async (req, res) => {
    console.log('--- NUEVO WEBHOOK DE N8N ---');
    console.log('📦 Body:', JSON.stringify(req.body));
    console.log('---------------------------');

    // n8n a veces envía un array de objetos: [{...}] — desenvuelver
    const rawBody = Array.isArray(req.body) ? req.body[0] : req.body;

    let {
        phone,
        contact_name,
        name,           // alias que usa n8n
        message,
        output,         // alias que usa n8n en lugar de 'message'
        whatsapp_id,
        sender_type = 'bot', // n8n siempre es bot/IA
        timestamp,
        media_type,
        media_url,
        tag
    } = rawBody;

    // Normalizar aliases de n8n
    if (!message && output) message = output;           // output → message
    if (!contact_name && name) contact_name = name;     // name → contact_name
    // Si n8n no envía sender_type, asumimos que es el bot respondiendo
    if (!rawBody.sender_type) sender_type = 'bot';


    if (!phone) {
        console.error('❌ Error: El webhook no incluyó un número de teléfono (phone)');
        return res.status(400).json({ error: 'Phone number required' });
    }

    // Evolution ofrece el número puro (57304...). El dashboard usa +57304...
    const dbPhone = normalizePhone(phone);
    const purePhone = getPureDigits(phone);

    let isBot = sender_type === 'bot' || sender_type === 'ai';
    let isAgent = sender_type === 'agent';

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

    // --- DETECCIÓN DE MENSAJES PROPIOS (ENVIADOS DESDE EL CELULAR) ---
    // Si el webhook viene de Evolution API vía N8N, a veces trae el flag fromMe
    const isFromMe = req.body.fromMe === true ||
        (req.body.data && req.body.data.key && req.body.data.key.fromMe === true);

    if (isFromMe) {
        console.log(`👤 [WEBHOOK] Detectado mensaje saliente (fromMe). Marcando como enviado por Agente.`);
        sender_type = 'agent';
        isAgent = true;
        isBot = false;
    }

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

    // === LÓGICA DE ETIQUETADO POR N8N ===
    if (tag && typeof tag === 'string') {
        try {
            const tagName = tag.trim();
            console.log(`🏷️ Intentando asignar etiqueta "${tagName}" a la conversación ${dbPhone}`);
            
            // 1. Buscar o Crear la etiqueta
            const tagResult = await pool.query(`
                INSERT INTO tags (name, color) VALUES ($1, $2) 
                ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color
                RETURNING id, name
            `, [tagName, '#ff0000']);
            
            const createdTag = tagResult.rows[0];

            // 2. Asignar la etiqueta a la conversación
            await pool.query(`
                INSERT INTO conversation_tags (conversation_phone, tag_id, assigned_by)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            `, [dbPhone, createdTag.id, 'n8n_agent']);

            // 3. Evaluar si forzamos pasar a agente
            const normalizedTagName = createdTag.name.toLowerCase();
            if (normalizedTagName === 'agendar' || normalizedTagName === 'soporte') {
                console.log(`✅ Etiqueta '${createdTag.name}' detectada desde n8n. Forzando a estado AGENTE.`);
                
                await pool.query(`
                    UPDATE conversations 
                    SET lead_time = NULL, ai_enabled = false, conversation_state = 'agent_active', agent_id = $1, updated_at = NOW()
                    WHERE phone = $2
                `, ['system', dbPhone]);
                
                // Actualizamos objeto en memoria para la emisión al socket
                conversation.ai_enabled = false;
                conversation.conversation_state = 'agent_active';
            } else {
                console.log(`✅ Etiqueta "${tagName}" asignada a ${dbPhone} exitosamente.`);
            }
        } catch (tagError) {
            console.error('❌ Error procesando etiqueta desde n8n:', tagError);
        }
    }

    const currentState = conversation?.conversation_state || 'ai_active';
    const shouldActivateAI = conversation?.ai_enabled !== false;

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
    } else {
        // Si el mensaje es del bot o agente (incluyendo desde el celular), marcamos como leído
        await conversationService.markAsRead(dbPhone);
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

