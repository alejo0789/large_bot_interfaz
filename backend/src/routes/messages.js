/**
 * Message Routes
 * OPTIMIZED: Uses Socket.IO rooms for targeted delivery
 */
const express = require('express');
const router = express.Router();
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { upload, getMediaType } = require('../middleware/upload');
const messageService = require('../services/messageService');
const conversationService = require('../services/conversationService');
const n8nService = require('../services/n8nService');

// Socket.IO instance (will be set from app.js)
let io = null;
const setSocketIO = (socketIO) => { io = socketIO; };

/**
 * Emit message to specific conversation room
 * Optimized for 2000+ conversations
 */
const emitToConversation = (phone, event, data) => {
    if (!io) return;

    // Emit to specific conversation room
    io.to(`conversation:${phone}`).emit(event, data);

    // Emit to global conversations list for updates
    io.to('conversations:list').emit('conversation-updated', {
        phone,
        lastMessage: data.message,
        timestamp: data.timestamp
    });

    // Also emit globally for backward compatibility
    io.emit('new-message', data);
};

// Send text message
router.post('/send-message', asyncHandler(async (req, res) => {
    const { phone, name, message, temp_id, agentId, agentName, agent_id, agent_name } = req.body;

    // Normalize agent params (frontend might send agentId or agent_id)
    const finalAgentId = agentId || agent_id;
    const finalAgentName = agentName || agent_name;

    console.log('📥 RAW BODY received:', JSON.stringify(req.body, null, 2));

    if (!phone || !message) {
        throw new AppError('Faltan datos requeridos (phone, message)', 400);
    }

    console.log(`📤 Sending message to ${phone} by ${finalAgentName || 'unknown'}: ${message.substring(0, 50)}...`);

    // Save message to database
    await messageService.create({
        phone,
        sender: 'agent',
        text: message,
        status: 'sending',
        agentId: finalAgentId,
        agentName: finalAgentName
    });

    // Update conversation
    await conversationService.updateLastMessage(phone, message);

    // Send to N8N
    const n8nResult = await n8nService.sendMessage({
        phone,
        name,
        message,
        tempId: temp_id,
        agentId: finalAgentId,
        agentName: finalAgentName
    });

    // Emit to frontend (OPTIMIZED: uses rooms)
    emitToConversation(phone, 'agent-message', {
        phone,
        message,
        sender_type: 'agent',
        timestamp: new Date().toISOString(),
        agent_id: finalAgentId,
        agent_name: finalAgentName
    });

    res.json({
        success: true,
        message: 'Mensaje enviado',
        n8n: n8nResult
    });
}));



// Send file
router.post('/send-file', upload.single('file'), asyncHandler(async (req, res) => {
    const { phone, name, caption, agent_id, agent_name } = req.body;
    const file = req.file;

    if (!file) {
        throw new AppError('No se recibió ningún archivo', 400);
    }

    if (!phone) {
        throw new AppError('Falta el número de teléfono', 400);
    }

    console.log(`📎 File received: ${file.originalname} for ${phone} by ${agent_name}`);

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    const mediaType = getMediaType(file.mimetype);

    // Save message to database
    await messageService.create({
        phone,
        sender: 'agent',
        text: caption || file.originalname,
        mediaType,
        mediaUrl: fileUrl,
        status: 'sending',
        agentId: agent_id,     // Note: FormData sends strings
        agentName: agent_name
    });

    // Update conversation
    await conversationService.updateLastMessage(phone, caption || `📎 ${file.originalname}`);

    // Send to N8N
    await n8nService.sendMessage({
        phone,
        name,
        message: caption || '',
        mediaType,
        mediaUrl: fileUrl,
        fileName: file.originalname
    });

    // Emit to frontend (OPTIMIZED: uses rooms)
    emitToConversation(phone, 'agent-message', {
        phone,
        message: caption || file.originalname,
        media_type: mediaType,
        media_url: fileUrl,
        sender_type: 'agent',
        timestamp: new Date().toISOString(),
        agent_id,
        agent_name
    });

    res.json({
        success: true,
        message: 'Archivo enviado',
        file: {
            name: file.originalname,
            url: fileUrl,
            type: mediaType,
            size: file.size
        }
    });
}));

// ==========================================
// BULK MESSAGE ENDPOINT - SCALABLE
// ==========================================
const bulkMessageService = require('../services/bulkMessageService');

/**
 * Send bulk messages with progress tracking
 * POST /api/bulk-send
 * Body: { recipients: [{phone, name}], message, mediaUrl?, mediaType? }
 */
router.post('/bulk-send', asyncHandler(async (req, res) => {
    const { recipients, message, mediaUrl, mediaType, agentId, agentName, agent_id, agent_name } = req.body;

    // Normalize agent params
    const finalAgentId = agentId || agent_id;
    const finalAgentName = agentName || agent_name;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        throw new AppError('Se requiere un array de destinatarios', 400);
    }

    if (!message && !mediaUrl) {
        throw new AppError('Se requiere un mensaje o archivo multimedia', 400);
    }

    // Generate unique batch ID
    const batchId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`📤 Starting bulk send ${batchId}: ${recipients.length} recipients by ${finalAgentName || 'unknown'}`);

    // Send function for each recipient
    const sendFn = async ({ phone, name, message: msg, mediaUrl: media, mediaType: mType }) => {
        // Ensure conversation exists
        await conversationService.upsert(phone, name);

        // Save message to database
        await messageService.create({
            phone,
            sender: 'agent',
            text: msg || '',
            mediaType: mType || null,
            mediaUrl: media || null,
            status: 'sending',
            agentId: finalAgentId,
            agentName: finalAgentName
        });

        // Update conversation
        await conversationService.updateLastMessage(phone, msg || '📎 Media');

        // Send to N8N for WhatsApp delivery
        await n8nService.sendMessage({
            phone,
            name,
            message: msg,
            mediaType: mType,
            mediaUrl: media,
            agentId: finalAgentId,
            agentName: finalAgentName
        });

        // Emit to frontend (OPTIMIZED: uses rooms)
        // This ensures the sender sees the message immediately correctly
        if (io) {
            io.to(`conversation:${phone}`).emit('agent-message', {
                phone,
                message: msg || (media ? 'Evaluando archivo...' : ''),
                media_type: mType,
                media_url: media,
                sender_type: 'agent',
                timestamp: new Date().toISOString(),
                agent_id: finalAgentId,
                agent_name: finalAgentName
            });

            // Also emit to global list
            io.to('conversations:list').emit('conversation-updated', {
                phone,
                lastMessage: msg || '📎 Media',
                timestamp: new Date().toISOString()
            });
        }
    };

    // Progress callback - emit via Socket.IO
    const onProgress = (progress) => {
        if (io) {
            io.emit('bulk-send-progress', progress);
        }
    };

    // Start processing in background (don't await)
    bulkMessageService.processBulkSend({
        batchId,
        recipients,
        message,
        mediaUrl,
        mediaType,
        sendFn,
        onProgress,
        onComplete: (result) => {
            if (io) {
                io.emit('bulk-send-complete', result);
            }
            console.log(`✅ Bulk send complete: ${result.sent}/${result.total} sent`);
        }
    }).catch(error => {
        console.error('❌ Bulk send error:', error);
        if (io) {
            io.emit('bulk-send-error', { batchId, error: error.message });
        }
    });

    // Respond immediately with batch ID
    res.json({
        success: true,
        batchId,
        message: `Iniciando envío masivo de ${recipients.length} mensajes`,
        estimatedTime: Math.ceil(recipients.length * 0.15) // ~0.15s per message
    });
}));

/**
 * Get bulk send status
 * GET /api/bulk-send/:batchId
 */
router.get('/bulk-send/:batchId', asyncHandler(async (req, res) => {
    const { batchId } = req.params;
    const status = bulkMessageService.getBatchStatus(batchId);

    if (!status) {
        throw new AppError('Batch no encontrado', 404);
    }

    res.json(status);
}));

module.exports = { router, setSocketIO };
