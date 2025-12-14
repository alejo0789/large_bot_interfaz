/**
 * Message Routes
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

// Send text message
router.post('/send-message', asyncHandler(async (req, res) => {
    const { phone, name, message, temp_id } = req.body;

    if (!phone || !message) {
        throw new AppError('Faltan datos requeridos (phone, message)', 400);
    }

    console.log(`📤 Sending message to ${phone}: ${message.substring(0, 50)}...`);

    // Save message to database
    await messageService.create({
        phone,
        sender: 'agent',
        text: message,
        status: 'sending'
    });

    // Update conversation
    await conversationService.updateLastMessage(phone, message);

    // Send to N8N
    const n8nResult = await n8nService.sendMessage({
        phone,
        name,
        message,
        tempId: temp_id
    });

    // Emit to frontend
    if (io) {
        io.emit('new-message', {
            phone,
            message,
            sender_type: 'agent',
            timestamp: new Date().toISOString()
        });
    }

    res.json({
        success: true,
        message: 'Mensaje enviado',
        n8n: n8nResult
    });
}));

// Send file
router.post('/send-file', upload.single('file'), asyncHandler(async (req, res) => {
    const { phone, name, caption } = req.body;
    const file = req.file;

    if (!file) {
        throw new AppError('No se recibió ningún archivo', 400);
    }

    if (!phone) {
        throw new AppError('Falta el número de teléfono', 400);
    }

    console.log(`📎 File received: ${file.originalname} for ${phone}`);

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    const mediaType = getMediaType(file.mimetype);

    // Save message to database
    await messageService.create({
        phone,
        sender: 'agent',
        text: caption || file.originalname,
        mediaType,
        mediaUrl: fileUrl,
        status: 'sending'
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

    // Emit to frontend
    if (io) {
        io.emit('new-message', {
            phone,
            message: caption || file.originalname,
            media_type: mediaType,
            media_url: fileUrl,
            sender_type: 'agent',
            timestamp: new Date().toISOString()
        });
    }

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

module.exports = { router, setSocketIO };
