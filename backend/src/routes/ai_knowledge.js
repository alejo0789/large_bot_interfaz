const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');

// Configurar multer para subida de archivos
const uploadDir = path.join(__dirname, '../../uploads/ai_knowledge');

// Asegurar que el directorio existe
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Nombre único: timestamp-random.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB límite
    },
    fileFilter: (req, file, cb) => {
        // Aceptar imágenes, audios y videos
        if (file.mimetype.startsWith('image/') ||
            file.mimetype.startsWith('audio/') ||
            file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Formato de archivo no soportado. Solo imágenes, audios y videos.'), false);
        }
    }
});

/**
 * GET /api/ai-knowledge
 * Listar recursos de conocimiento
 * Query params: type (image, video, audio, text), active (true/false)
 */
router.get('/', async (req, res, next) => {
    try {
        const { type, active } = req.query;
        let query = 'SELECT * FROM ai_knowledge WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (type) {
            query += ` AND type = $${paramCount}`;
            params.push(type);
            paramCount++;
        }

        if (active !== undefined) {
            query += ` AND active = $${paramCount}`;
            params.push(active === 'true');
            paramCount++;
        }

        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);

        // Mapear resultados para incluir URL completa si es necesario
        const resources = result.rows.map(row => ({
            ...row,
            full_url: row.media_url ?
                `${process.env.API_URL || 'http://localhost:4000'}${row.media_url}` : null
        }));

        res.json(resources);
    } catch (error) {
        console.error('❌ Error en GET /api/ai-knowledge:', {
            message: error.message,
            stack: error.stack,
            query: req.query
        });
        next(error);
    }
});

/**
 * POST /api/ai-knowledge/upload
 * Subir archivo (imagen, audio, video)
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo' });
        }

        const { description, keywords } = req.body;

        // Determinar tipo
        let type = 'image';
        if (req.file.mimetype.startsWith('audio/')) type = 'audio';
        if (req.file.mimetype.startsWith('video/')) type = 'video';

        const mediaUrl = `/uploads/ai_knowledge/${req.file.filename}`;
        const keywordArray = keywords ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim())) : [];

        const query = `
            INSERT INTO ai_knowledge 
            (type, content, media_url, filename, keywords) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *
        `;

        const values = [type, description || '', mediaUrl, req.file.originalname, keywordArray];
        const result = await pool.query(query, values);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        // Limpiar archivo si hubo error en DB
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error borrando archivo tras fallo:', err);
            });
        }
        next(error);
    }
});

/**
 * POST /api/ai-knowledge/text
 * Crear contexto de texto
 */
router.post('/text', async (req, res, next) => {
    try {
        const { title, content, keywords } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'El contenido es obligatorio' });
        }

        const keywordArray = keywords ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim())) : [];

        const query = `
            INSERT INTO ai_knowledge 
            (type, title, content, keywords) 
            VALUES ($1, $2, $3, $4) 
            RETURNING *
        `;

        const values = ['text', title || '', content, keywordArray];
        const result = await pool.query(query, values);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/ai-knowledge/:id
 * Eliminar recurso
 */
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        // Obtener info del recurso antes de borrar para eliminar archivo si existe
        const checkQuery = 'SELECT * FROM ai_knowledge WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [id]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Recurso no encontrado' });
        }

        const resource = checkResult.rows[0];

        // Borrar de DB
        await pool.query('DELETE FROM ai_knowledge WHERE id = $1', [id]);

        // Borrar archivo físico si existe
        if (resource.media_url) {
            // media_url es relativo: /uploads/ai_knowledge/filename.ext
            // convertir a ruta absoluta del sistema
            // media_url empieza con /, quitamos el primer caracter
            const relativePath = resource.media_url.substring(1);
            const filePath = path.join(__dirname, '../../', relativePath);

            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, (err) => {
                    if (err) console.error('Error borrando archivo:', err);
                });
            }
        }

        res.json({ message: 'Recurso eliminado correctamente', id });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
