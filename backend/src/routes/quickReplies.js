const express = require('express');
const router = express.Router();
const quickReplyService = require('../services/quickReplyService');
const { upload } = require('../middleware/upload');
const { config } = require('../config/app');

/**
 * POST /api/quick-replies/upload
 * Upload media for quick reply
 */
router.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo' });
        }

        // Use the request host to construct the URL
        // This ensures it works for the current environment (local or production)
        const protocol = req.protocol;
        const host = req.get('host');
        // If behind a proxy (like Nginx/Railway), use 'x-forwarded-proto' and 'x-forwarded-host' if available
        // But for now, simple req.get('host') is safer for local dev
        const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

        res.json({
            url: fileUrl,
            filename: req.file.filename,
            type: req.file.mimetype
        });
    } catch (error) {
        console.error('Error uploading quick reply media:', error);
        res.status(500).json({ error: 'Error al subir el archivo' });
    }
});

/**
 * GET /api/quick-replies
 * Get all quick replies
 */
router.get('/', async (req, res) => {
    try {
        const replies = await quickReplyService.getAll();
        res.json(replies);
    } catch (error) {
        console.error('Error fetching quick replies:', error);
        res.status(500).json({ error: 'Error al obtener respuestas rápidas' });
    }
});

/**
 * POST /api/quick-replies
 * Create a new quick reply
 */
router.post('/', async (req, res) => {
    try {
        const { shortcut, content, mediaUrl, mediaType } = req.body;

        if (!shortcut || !content) {
            return res.status(400).json({ error: 'El atajo y el contenido son obligatorios' });
        }

        const newReply = await quickReplyService.create({ shortcut, content, mediaUrl, mediaType });
        res.status(201).json(newReply);
    } catch (error) {
        console.error('Error creating quick reply:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Ya existe una respuesta rápida con este atajo' });
        }
        res.status(500).json({ error: 'Error al crear la respuesta rápida' });
    }
});

/**
 * PUT /api/quick-replies/:id
 * Update a quick reply
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { shortcut, content, mediaUrl, mediaType } = req.body;

        const updatedReply = await quickReplyService.update(id, { shortcut, content, mediaUrl, mediaType });

        if (!updatedReply) {
            return res.status(404).json({ error: 'Respuesta rápida no encontrada' });
        }

        res.json(updatedReply);
    } catch (error) {
        console.error('Error updating quick reply:', error);
        res.status(500).json({ error: 'Error al actualizar la respuesta rápida' });
    }
});

/**
 * DELETE /api/quick-replies/:id
 * Delete a quick reply
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await quickReplyService.delete(id);
        res.json({ message: 'Respuesta rápida eliminada correctamente' });
    } catch (error) {
        console.error('Error deleting quick reply:', error);
        res.status(500).json({ error: 'Error al eliminar la respuesta rápida' });
    }
});

module.exports = router;
