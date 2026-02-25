/**
 * Message Routes
 * OPTIMIZED: Uses Socket.IO rooms for targeted delivery
 */
const express = require('express');
const router = express.Router();
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { upload, getMediaType } = require('../middleware/upload');
const messageService = require('../services/messageService');
const optimizeMedia = require('../middleware/optimizeMedia');
const conversationService = require('../services/conversationService');

const n8nService = require('../services/n8nService');
const evolutionService = require('../services/evolutionService');
const { config } = require('../config/app');
const { requireApiKey } = require('../middleware/apiKeyAuth');

// Socket.IO instance (will be set from app.js)
let io = null;
const setSocketIO = (socketIO) => { io = socketIO; };

/**
 * Emit message to specific conversation room
 * Optimized for 2000+ conversations
 * NORMALIZED: emits to both +57xxx and 57xxx formats
 */
const emitToConversation = (phone, event, data) => {
    if (!io) return;

    // Normalize phone to ensure delivery to both formats
    const purePhone = String(phone).replace(/\D/g, '');
    const dbPhone = purePhone.startsWith('57') ? `+${purePhone}` : purePhone;

    // Emit to specific conversation room (DB format with +)
    io.to(`conversation:${dbPhone}`).emit(event, data);

    // Also emit to pure format (without +) for clients that joined with that
    if (dbPhone !== purePhone) {
        io.to(`conversation:${purePhone}`).emit(event, data);
    }

    const isAgent = (data.sender_type || data.sender) === 'agent';

    // Emit to global conversations list for updates
    io.to('conversations:list').emit('conversation-updated', {
        phone: dbPhone,
        lastMessage: data.message,
        timestamp: data.timestamp || new Date().toISOString(),
        contact_name: data.contact_name,
        unread: isAgent ? 0 : 1,
        sender_type: data.sender_type || 'agent'
    });

    // Also emit globally for backward compatibility
    io.emit('new-message', data);
};

// Send text message
router.post('/send-message', requireApiKey, asyncHandler(async (req, res) => {
    const { phone, name, message, temp_id, agentId, agentName, agent_id, agent_name, reply_to } = req.body;

    // Normalize agent params (frontend might send agentId or agent_id)
    const finalAgentId = agentId || agent_id;
    const finalAgentName = agentName || agent_name;

    console.log('📥 RAW BODY received:', JSON.stringify(req.body, null, 2));

    // Normalize phone: 
    // If it has a domain (@), it's a JID or a special ID, KEEP IT AS IS.
    // Otherwise, clean it as a standard number.
    // Customize phone normalization to match webhook (Evolution) logic
    // 1. Strip non-digits
    const cleanPhone = String(phone).replace(/\D/g, '');
    // 2. If it's a special ID (groups, etc), use original. Else, format.
    const isSpecialId = String(phone).includes('@') || String(phone).includes('-');

    let normalizedPhone = cleanPhone;
    if (!isSpecialId) {
        // Match evolution.js: Add '+' for Colombia numbers (57) for consistency
        if (cleanPhone.startsWith('57')) {
            normalizedPhone = `+${cleanPhone}`;
        }
    } else {
        normalizedPhone = String(phone);
    }

    console.log(`📤 Processed phone for sending: ${normalizedPhone} (was: ${phone})`);

    // Ensure conversation exists to avoid FK error
    await conversationService.upsert(normalizedPhone, name);

    // Fetch quoted message data if reply_to is present
    let replyToData = null;
    if (reply_to) {
        const quotedMsg = await messageService.getById(reply_to);
        if (quotedMsg) {
            replyToData = {
                id: quotedMsg.whatsapp_id || quotedMsg.id,
                text: quotedMsg.text_content,
                sender: quotedMsg.sender_name || (quotedMsg.sender === 'agent' ? finalAgentName : 'Cliente')
            };
        }
    }

    // Save message to database using normalized phone
    const savedMessage = await messageService.create({
        phone: normalizedPhone,
        sender: 'agent',
        text: message,
        status: 'sending',
        // Use ISO string for consistent parsing
        timestamp: new Date().toISOString(),
        agentId: finalAgentId,
        agentName: finalAgentName,
        senderName: finalAgentName,
        replyToId: replyToData?.id,
        replyToText: replyToData?.text,
        replyToSender: replyToData?.sender
    });

    // Update conversation
    await conversationService.updateLastMessage(normalizedPhone, message);
    await conversationService.markAsRead(normalizedPhone);

    // Send Message Logic (Evolution > N8N)
    let sendResult;
    if (config.evolutionApiUrl) {
        const result = await evolutionService.sendText(normalizedPhone, message, reply_to);
        sendResult = { sent: result.success, platform: 'evolution', ...result };
    } else {
        const result = await n8nService.sendMessage({
            phone: normalizedPhone,
            name,
            message,
            tempId: temp_id,
            agentId: finalAgentId,
            agentName: finalAgentName
        });
        sendResult = { sent: result.sent, platform: 'n8n', ...result };
    }

    // UPDATE STATUS IN DB after successful send
    if (sendResult.sent) {
        // Extract WhatsApp ID if available (Evolution v2: result.data.key.id)
        let whatsappId = null;
        if (sendResult.platform === 'evolution' && sendResult.data) {
            if (sendResult.data.key && sendResult.data.key.id) {
                whatsappId = sendResult.data.key.id;
            }
        }

        if (whatsappId) {
            console.log(`✅ Updating message ${savedMessage.id} with WhatsApp ID: ${whatsappId}`);
            await messageService.updateWhatsappId(savedMessage.id, whatsappId, 'delivered');
            // Update the whatsapp_id that will be emitted to frontend
            savedMessage.whatsapp_id = whatsappId;
        } else {
            await messageService.updateStatus(savedMessage.id, 'delivered');
        }
    } else {
        await messageService.updateStatus(savedMessage.id, 'failed');
    }

    emitToConversation(normalizedPhone, 'agent-message', {
        whatsapp_id: savedMessage.whatsapp_id || savedMessage.id, // Use actual WA ID if available
        phone: normalizedPhone,
        message,
        sender: 'agent', // Added for consistency
        sender_type: 'agent',
        timestamp: new Date().toISOString(),
        agent_id: finalAgentId,
        agent_name: finalAgentName,
        sender_name: finalAgentName,
        status: sendResult.sent ? 'delivered' : 'failed',
        replyTo: replyToData
    });

    res.json({
        success: true,
        message: 'Mensaje enviado',
        result: sendResult,
        newMessage: savedMessage
    });
}));



// Send file
router.post('/send-file', requireApiKey, upload.single('file'), optimizeMedia, asyncHandler(async (req, res) => {
    const { phone, name, caption, agent_id, agent_name, temp_id, reply_to } = req.body;
    const file = req.file;

    if (!file) {
        throw new AppError('No se recibió ningún archivo', 400);
    }

    if (!phone) {
        throw new AppError('Falta el número de teléfono', 400);
    }

    console.log(`📎 File received: ${file.originalname} for ${phone} by ${agent_name}`);

    // Final URL (Public or Local)
    const fileUrl = `${config.publicUrl}/uploads/${file.filename}`;
    const mediaType = getMediaType(file.mimetype);

    // Ensure conversation exists to avoid FK error
    await conversationService.upsert(phone, name);

    // Fetch quoted message data if reply_to is present
    let replyToData = null;
    if (reply_to) {
        const quotedMsg = await messageService.getById(reply_to);
        if (quotedMsg) {
            replyToData = {
                id: quotedMsg.whatsapp_id || quotedMsg.id,
                text: quotedMsg.text_content,
                sender: quotedMsg.sender_name || (quotedMsg.sender === 'agent' ? agent_name : 'Cliente')
            };
        }
    }

    // Save message to database
    const savedMessage = await messageService.create({
        phone,
        sender: 'agent',
        text: (mediaType === 'image' || mediaType === 'video' || mediaType === 'audio') ? (caption || null) : (caption || file.originalname),
        mediaType,
        mediaUrl: fileUrl,
        status: 'sending',
        agentId: agent_id,     // Note: FormData sends strings
        agentName: agent_name,
        senderName: agent_name,
        timestamp: new Date().toISOString(),
        replyToId: replyToData?.id,
        replyToText: replyToData?.text,
        replyToSender: replyToData?.sender
    });

    // Update conversation
    await conversationService.updateLastMessage(phone, caption || `📎 ${file.originalname}`);
    await conversationService.markAsRead(phone);

    // Send Media Logic
    let sendResult = { sent: false };

    if (config.evolutionApiUrl) {
        const result = await evolutionService.sendMedia(phone, fileUrl, mediaType, caption || '', file.originalname, reply_to);
        sendResult = { sent: result && result.success, platform: 'evolution', ...result };
    } else {
        const result = await n8nService.sendMessage({
            phone,
            name,
            message: caption || '',
            mediaType,
            mediaUrl: fileUrl,
            fileName: file.originalname
        });
        sendResult = { sent: result && result.sent, platform: 'n8n', ...result };
    }

    // UPDATE STATUS IN DB after successful send
    if (sendResult.sent) {
        // Extract WhatsApp ID if available (Evolution v2: result.data.key.id)
        let whatsappId = null;
        if (sendResult.platform === 'evolution' && sendResult.data) {
            if (sendResult.data.key && sendResult.data.key.id) {
                whatsappId = sendResult.data.key.id;
            }
        }

        if (whatsappId) {
            console.log(`✅ Updating message ${savedMessage.id} with WhatsApp ID: ${whatsappId}`);
            await messageService.updateWhatsappId(savedMessage.id, whatsappId, 'delivered');
            savedMessage.whatsapp_id = whatsappId;
        } else {
            await messageService.updateStatus(savedMessage.id, 'delivered');
        }
    } else {
        await messageService.updateStatus(savedMessage.id, 'failed');
    }

    // Emit to frontend (OPTIMIZED: uses rooms)
    emitToConversation(phone, 'agent-message', {
        whatsapp_id: savedMessage.whatsapp_id || savedMessage.id,
        phone,
        message: (mediaType === 'image' || mediaType === 'video' || mediaType === 'audio') ? (caption || null) : (caption || file.originalname),
        media_type: mediaType,
        media_url: fileUrl,
        sender: 'agent', // Added for consistency
        sender_type: 'agent',
        timestamp: new Date().toISOString(),
        agent_id,
        agent_name,
        sender_name: agent_name,
        status: sendResult.sent ? 'delivered' : 'failed',
        temp_id: temp_id, // Emitting back the temp_id so frontend can match
        replyTo: replyToData
    });

    res.json({
        success: true,
        message: 'Archivo enviado',
        file: {
            name: file.originalname,
            url: fileUrl,
            type: mediaType,
            size: file.size
        },
        newMessage: savedMessage
    });
}));

// Basic upload endpoint (just saves file and returns URL)
router.post('/upload', upload.single('file'), optimizeMedia, asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw new AppError('No se recibió ningún archivo', 400);

    let fileUrl = `${config.publicUrl}/uploads/${file.filename}`;

    // Si se especifica un folder en el query (ej: folder=bulk)
    if (req.query.folder === 'bulk') {
        const fs = require('fs');
        const path = require('path');
        const bulkDir = path.join(config.uploadDir, 'bulk');

        if (!fs.existsSync(bulkDir)) {
            fs.mkdirSync(bulkDir, { recursive: true });
        }

        const newPath = path.join(bulkDir, file.filename);
        fs.renameSync(file.path, newPath);
        fileUrl = `${config.publicUrl}/uploads/bulk/${file.filename}`;
    }

    const mediaType = getMediaType(file.mimetype);

    res.json({
        success: true,
        file: {
            name: file.originalname,
            url: fileUrl,
            type: mediaType,
            size: file.size
        }
    });
}));

const fs = require('fs');
const path = require('path');

// Get all uploaded files
router.get('/upload/files', requireApiKey, asyncHandler(async (req, res) => {
    let uploadDir = config.uploadDir;

    if (req.query.folder === 'bulk') {
        uploadDir = path.join(config.uploadDir, 'bulk');
    }

    if (!fs.existsSync(uploadDir)) {
        return res.json({ success: true, files: [] });
    }

    const files = fs.readdirSync(uploadDir);
    const fileList = files.map(filename => {
        const filePath = path.join(uploadDir, filename);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) return null;

        let fileType = 'document';
        const ext = path.extname(filename).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) fileType = 'image';
        else if (['.mp4', '.webm', '.ogg'].includes(ext)) fileType = 'video';
        else if (['.mp3', '.wav', '.ogg'].includes(ext)) fileType = 'audio';

        const fileUrlPath = req.query.folder === 'bulk' ? `uploads/bulk/${filename}` : `uploads/${filename}`;

        return {
            name: filename,
            url: `${config.publicUrl}/${fileUrlPath}`,
            type: fileType,
            size: stats.size,
            createdAt: stats.birthtime
        };
    }).filter(f => f !== null).sort((a, b) => b.createdAt - a.createdAt); // Newest first

    res.json({ success: true, files: fileList });
}));

// Delete an uploaded file
router.delete('/upload/files/:filename', requireApiKey, asyncHandler(async (req, res) => {
    const filename = req.params.filename;
    // Basic security to avoid directory traversal
    if (filename.includes('..') || filename.includes('/')) {
        throw new AppError('Nombre de archivo inválido', 400);
    }

    let filePath = path.join(config.uploadDir, filename);
    if (req.query.folder === 'bulk') {
        filePath = path.join(config.uploadDir, 'bulk', filename);
    }

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true, message: 'Archivo eliminado' });
    } else {
        throw new AppError('Archivo no encontrado', 404);
    }
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
router.post('/bulk-send', requireApiKey, asyncHandler(async (req, res) => {
    const { recipients, message, mediaUrl, mediaType, agentId, agentName, agent_id, agent_name } = req.body;

    // Normalize agent params
    const finalAgentId = agentId || agent_id;
    const finalAgentName = agentName || agent_name;

    if ((!recipients || !Array.isArray(recipients) || recipients.length === 0) && !req.body.filters) {
        throw new AppError('Se requiere un array de destinatarios o filtros de búsqueda', 400);
    }

    if (!message && !mediaUrl) {
        throw new AppError('Se requiere un mensaje o archivo multimedia', 400);
    }

    // Generate unique batch ID
    const batchId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Determine final recipients
    let finalRecipients = recipients || [];

    // If filters are provided and no explicit recipients (or mixed), fetch from DB
    if (req.body.filters && (!recipients || recipients.length === 0)) {
        console.log('🔍 Fetching recipients from DB with filters:', req.body.filters);
        const dbRecipients = await conversationService.getRecipients(req.body.filters);
        finalRecipients = dbRecipients;
        console.log(`✅ Found ${finalRecipients.length} recipients from DB`);
    }

    if (finalRecipients.length === 0) {
        throw new AppError('No se encontraron destinatarios para los filtros seleccionados', 404);
    }

    console.log(`📤 Starting bulk send ${batchId}: ${finalRecipients.length} recipients by ${finalAgentName || 'unknown'}`);

    // Send function for each recipient
    const sendFn = async ({ phone, name, message: msg, mediaUrl: media, mediaType: mType }) => {
        // Normalize phone to match webhook logic (evolution.js)
        const cleanPhone = String(phone).replace(/\D/g, '');
        const isSpecialId = String(phone).includes('@') || String(phone).includes('-');
        let normalizedPhone = cleanPhone;

        if (!isSpecialId) {
            // Match evolution.js: Add '+' for Colombia numbers (57) for consistency
            if (cleanPhone.startsWith('57')) {
                normalizedPhone = `+${cleanPhone}`;
            }
        } else {
            normalizedPhone = String(phone);
        }

        // Determinar los mensajes a enviar
        const messagesToSend = [];
        if (msg && media && mType) {
            // Si hay texto y media, enviar dos mensajes: primero texto, luego media
            messagesToSend.push({ text: msg, mediaUrl: null, mediaType: null, isMedia: false });
            messagesToSend.push({ text: '', mediaUrl: media, mediaType: mType, isMedia: true });
        } else {
            messagesToSend.push({ text: msg || '', mediaUrl: media || null, mediaType: mType || null, isMedia: !!media });
        }

        // Ensure conversation exists
        await conversationService.upsert(normalizedPhone, name);

        const savedMessages = [];

        // Save messages to database
        for (const m of messagesToSend) {
            const savedMessage = await messageService.create({
                phone: normalizedPhone,
                sender: 'agent',
                text: m.text,
                mediaType: m.mediaType,
                mediaUrl: m.mediaUrl,
                status: 'sending',
                agentId: finalAgentId,
                agentName: finalAgentName,
                senderName: finalAgentName
            });
            savedMessages.push(savedMessage);
        }

        // Update conversation
        await conversationService.updateLastMessage(normalizedPhone, media && !msg ? '📎 Media' : (msg || '📎 Media'));
        await conversationService.markAsRead(normalizedPhone);

        // Send Logic (Evolution > N8N)
        if (config.evolutionApiUrl) {
            for (let i = 0; i < messagesToSend.length; i++) {
                const m = messagesToSend[i];
                let result;
                if (m.isMedia) {
                    result = await evolutionService.sendMedia(normalizedPhone, m.mediaUrl, m.mediaType, m.text, 'file');
                } else {
                    result = await evolutionService.sendText(normalizedPhone, m.text);
                }

                if (!result.success) {
                    throw new Error(result.error?.message || 'Error en Evolution API');
                }

                // Add delay between multiple messages to maintain order
                if (messagesToSend.length > 1 && i < messagesToSend.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } else {
            // Fallback to N8N
            for (let i = 0; i < messagesToSend.length; i++) {
                const m = messagesToSend[i];
                await n8nService.sendMessage({
                    phone: normalizedPhone,
                    name,
                    message: m.text,
                    mediaType: m.mediaType,
                    mediaUrl: m.mediaUrl,
                    agentId: finalAgentId,
                    agentName: finalAgentName
                });

                // Add delay between multiple messages to maintain order
                if (messagesToSend.length > 1 && i < messagesToSend.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        // Update status in DB after successful send
        for (const saved of savedMessages) {
            await messageService.updateStatus(saved.id, 'delivered');
        }

        // Emit to frontend (OPTIMIZED: uses rooms)
        // This ensures the sender sees the message immediately correctly
        if (io) {
            for (let i = 0; i < messagesToSend.length; i++) {
                const m = messagesToSend[i];
                const saved = savedMessages[i];

                io.to(`conversation:${normalizedPhone}`).emit('agent-message', {
                    id: saved.id,
                    phone: normalizedPhone,
                    message: m.text || (m.isMedia ? 'Evaluando archivo...' : ''),
                    media_type: m.mediaType,
                    media_url: m.mediaUrl,
                    sender_type: 'agent',
                    timestamp: new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }),
                    agent_id: finalAgentId,
                    agent_name: finalAgentName,
                    sender_name: finalAgentName,
                    status: 'delivered'
                });
            }

            // Also emit to global list
            io.to('conversations:list').emit('conversation-updated', {
                phone: normalizedPhone,
                lastMessage: media ? '📎 Media' : msg,
                timestamp: new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }),
                unread: 0,
                sender_type: 'agent'
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
        recipients: finalRecipients,
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
        message: `Iniciando envío masivo de ${finalRecipients.length} mensajes`,
        estimatedTime: Math.ceil(finalRecipients.length * 12.5) // Average of 5-20s per message
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


/**
 * Delete a message
 * DELETE /api/messages/:id
 */
/**
 * Add reaction to a message
 * POST /api/messages/:id/reaction
 */
router.post('/messages/:id/reaction', asyncHandler(async (req, res) => {
    console.log('🚀 [Reaction Route] Request Received');
    const { id } = req.params;
    const { reaction, phone } = req.body; // reaction: emoji or '', phone: conversation phone

    if (!phone) {
        throw new AppError('Phone is required', 400);
    }

    // Fetch the message to know who sent it
    const message = await messageService.getMessageById(id);
    let fromMe = false;
    let targetMessageId = id; // Default to provided ID

    if (message) {
        // If sender is 'agent', 'me', 'system', 'bot', or 'ai', then it is fromMe=true
        // If sender is 'user' or 'customer', then fromMe=false
        const outgoingSenders = ['agent', 'me', 'system', 'bot', 'ai'];
        fromMe = outgoingSenders.includes(message.sender);

        // CRITICAL FIX: Use the WhatsApp ID (key.id) for the API, not our local DB UUID
        if (message.whatsapp_id) {
            targetMessageId = message.whatsapp_id;
        }

        console.log(`🔍 Reaction context: Found msg. Sender: ${message.sender}, fromMe=${fromMe}, whatsapp_id=${targetMessageId}`);
    } else {
        console.warn(`⚠️ Reaction warning: Message ${id} not found in DB. Defaulting to fromMe=false`);
    }

    // 1. Send to Evolution API
    let apiSuccess = false;
    console.log(`🔌 [Reaction] Checking Evolution Config: URL=${config.evolutionApiUrl}`);

    if (config.evolutionApiUrl) {
        // Pass the correct WhatsApp ID (targetMessageId)
        const result = await evolutionService.sendReaction(phone, targetMessageId, reaction, fromMe);
        apiSuccess = result.success;
    } else {
        // Fallback or skip if no API
        console.warn('Evolution API not configured, skipping external reaction');
    }

    // 2. Persist in DB
    const persisted = await messageService.addReaction(id, reaction);

    // 3. Emit event
    if (io) {
        io.emit('message-reaction', {
            id,
            reaction,
            phone,
            by: 'me'
        });
    }

    res.json({
        success: true,
        persisted,
        apiSuccess,
        message: 'Reaction processed',
        debug: {
            originalId: id,
            targetMessageId,
            fromMe,
            sender: message ? message.sender : 'unknown',
            evolutionUrl: config.evolutionApiUrl,
            foundInDb: !!message
        }
    });
}));

router.delete('/messages/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if message exists and get details
    const message = await messageService.getMessageById(id);

    if (!message) {
        throw new AppError('Mensaje no encontrado', 404);
    }

    // 1. Delete from WhatsApp (Evolution ID)
    let apiDeleted = false;
    if (config.evolutionApiUrl) {
        // Only attempt to delete from WA if we have a valid whatsapp_id
        if (message.whatsapp_id) {
            const outgoingSenders = ['agent', 'me', 'system', 'bot', 'ai'];
            const fromMe = outgoingSenders.includes(message.sender);

            // Phone is needed for JID construction
            const result = await evolutionService.deleteMessage(message.conversation_phone, message.whatsapp_id, fromMe);
            apiDeleted = result.success;
        } else {
            console.warn('⚠️ Cannot delete from WA: Missing whatsapp_id for message', id);
        }
    }

    // 2. Delete from DB
    const deleted = await messageService.deleteMessage(id);

    if (deleted) {
        // Emit deletion event to frontend
        if (io) {
            // Emit update instead of delete so frontend shows the "deleted" placeholder
            io.emit('message-updated', {
                id, // DB ID
                whatsapp_id: message.whatsapp_id, // WA ID (IMPORTANT for frontend matching)
                status: 'deleted',
                text: '🚫 Mensaje eliminado',
                media_url: null,
                media_type: null,
                phone: message.conversation_phone
            });
        }

        res.json({
            success: true,
            message: 'Mensaje eliminado',
            apiDeleted
        });
    } else {
        throw new AppError('Error al eliminar mensaje de la base de datos', 500);
    }
}));

// Edit message (only outgoing typically)
router.put('/messages/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;

    if (!text) {
        throw new AppError('El texto es requerido para editar', 400);
    }

    // Check if message exists and get details
    const message = await messageService.getMessageById(id);

    if (!message) {
        throw new AppError('Mensaje no encontrado', 404);
    }

    const outgoingSenders = ['agent', 'me', 'system', 'bot', 'ai'];
    const fromMe = outgoingSenders.includes(message.sender);

    if (!fromMe) {
        throw new AppError('Solo puedes editar mensajes enviados por ti', 403);
    }

    // 1. Update in WhatsApp (Evolution ID)
    let apiEdited = false;
    if (config.evolutionApiUrl) {
        if (message.whatsapp_id) {
            console.log(`📝 [Edit] Attempting to edit WhatsApp message ${message.whatsapp_id} for ${message.conversation_phone}`);
            console.log(`   New text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

            const result = await evolutionService.updateMessage(message.conversation_phone, message.whatsapp_id, text, fromMe);
            if (!result.success) {
                const errorMsg = result.error?.response?.message || result.error?.message || 'Error desconocido';
                console.error(`❌ [Edit] Evolution API update failed:`, result.error);
                throw new AppError('No se pudo editar el mensaje en WhatsApp: ' + errorMsg, 400);
            }
            console.log(`✅ [Edit] WhatsApp message ${message.whatsapp_id} updated successfully`);
            apiEdited = true;
        } else {
            console.warn('⚠️ [Edit] Cannot edit in WA: Missing whatsapp_id for message', id);
        }
    }

    // 2. Update in DB
    const edited = await messageService.updateMessageText(id, text);

    if (edited) {
        // Emit update event to frontend
        if (io) {
            io.emit('message-updated', {
                id, // DB ID
                whatsapp_id: message.whatsapp_id, // WA ID
                status: message.status,
                text: text,
                media_url: message.media_url,
                media_type: message.media_type,
                phone: message.conversation_phone,
                edited: true
            });
        }

        res.json({
            success: true,
            message: 'Mensaje editado correctamente',
            apiEdited
        });
    } else {
        throw new AppError('Error al editar el mensaje en base de datos', 500);
    }
}));

module.exports = { router, setSocketIO };
