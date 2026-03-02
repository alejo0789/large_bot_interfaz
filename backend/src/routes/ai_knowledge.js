const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { config } = require('../config/app');
const { tenantContext } = require('../utils/tenantContext');

// Helper to get tenant-specific knowledge upload directory
const getKnowledgeDir = () => {
    const context = tenantContext.getStore();
    const slug = context?.tenant?.slug;

    // Base dir: e.g., uploads/
    // Tenant dir: e.g., uploads/cali/
    // Knowledge dir: e.g., uploads/cali/ai_knowledge/

    let baseDir = config.uploadDir;
    if (slug) {
        baseDir = path.join(config.uploadDir, slug);
    }

    const kDir = path.join(baseDir, 'ai_knowledge');
    if (!fs.existsSync(kDir)) {
        fs.mkdirSync(kDir, { recursive: true });
    }
    return { dir: kDir, slug };
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const { dir } = getKnowledgeDir();
        cb(null, dir);
    },
    filename: function (req, file, cb) {
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
        const resources = result.rows.map(row => {
            let fullUrl = row.media_url;
            if (fullUrl && fullUrl.startsWith('/uploads')) {
                fullUrl = `${config.publicUrl}${fullUrl}`;
            }
            return {
                ...row,
                full_url: fullUrl
            };
        });

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

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Función para generar embeddings automáticamente
// Función para generar embeddings automáticamente
async function getEmbedding(text) {
    const API_KEY = process.env.GOOGLE_AI_API_KEY;
    if (!API_KEY) {
        console.error('❌ Error: GOOGLE_AI_API_KEY no configurada');
        return null;
    }

    if (!text || !text.trim()) {
        console.warn('⚠️ Texto vacío para embedding, omitiendo...');
        return null;
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: { parts: [{ text }] },
                output_dimensionality: 3072
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`❌ Google API Error: ${data.error?.message || response.statusText}`);
            return null;
        }

        return data.embedding ? `[${data.embedding.values.join(',')}]` : null;
    } catch (err) {
        console.error('❌ Error generando embedding automático:', err.message);
        return null;
    }
}

/**
 * POST /api/ai-knowledge/upload
 * Subir archivo (imagen, audio, video)
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo' });
        }

        const { description, keywords, title, price, active } = req.body;
        let type = 'image';
        if (req.file.mimetype.startsWith('audio/')) type = 'audio';
        if (req.file.mimetype.startsWith('video/')) type = 'video';

        const { slug } = getKnowledgeDir();
        const mediaUrl = slug
            ? `/uploads/${slug}/ai_knowledge/${req.file.filename}`
            : `/uploads/ai_knowledge/${req.file.filename}`;
        const keywordArray = keywords ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim())) : [];

        // Generar embedding automático del contenido/descripción
        const embeddingText = `${title || ''} ${description || ''}`.trim();
        const embedding = await getEmbedding(embeddingText);

        const priceVal = price ? parseFloat(price) : null;
        const activeVal = active === 'false' ? false : true;

        const query = `
            INSERT INTO ai_knowledge 
            (type, title, content, media_url, filename, keywords, embedding, price, active) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING *
        `;

        const values = [type, title || '', description || '', mediaUrl, req.file.originalname, keywordArray, embedding, priceVal, activeVal];
        const result = await pool.query(query, values);

        res.status(201).json(result.rows[0]);
    } catch (error) {
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
 * Crear contexto de texto (opcionalmente con imagen)
 */
router.post('/text', upload.single('file'), async (req, res, next) => {
    try {
        const { title, content, keywords, media_url, price, active } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'El contenido es obligatorio' });
        }

        // Si se subió un archivo, generamos la URL, de lo contrario usamos la URL del body si existe
        let finalMediaUrl = null;
        if (req.file) {
            const { slug } = getKnowledgeDir();
            finalMediaUrl = slug
                ? `/uploads/${slug}/ai_knowledge/${req.file.filename}`
                : `/uploads/ai_knowledge/${req.file.filename}`;
            console.log(`📸 Imagen subida para contexto: ${finalMediaUrl}`);
        } else if (media_url) {
            finalMediaUrl = media_url;
            console.log(`🔗 URL de imagen recibida: ${finalMediaUrl}`);
        }

        const keywordArray = keywords ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim())) : [];
        const priceVal = price ? parseFloat(price) : null;
        const activeVal = active === 'false' ? false : true;

        // Generar embedding automático (Título + Contenido)
        const embeddingText = `${title || ''} ${content || ''}`.trim();
        console.log(`🧬 Generando embedding automático para: ${title || 'Sin título'}`);
        const embedding = await getEmbedding(embeddingText);

        const query = `
            INSERT INTO ai_knowledge 
            (type, title, content, keywords, embedding, media_url, price, active) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING *
        `;

        const values = ['text', title || '', content, keywordArray, embedding, finalMediaUrl, priceVal, activeVal];
        const result = await pool.query(query, values);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        // Si hubo error, borrar el archivo subido si existe
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error borrando archivo tras fallo:', err);
            });
        }
        next(error);
    }
});

/**
 * PUT /api/ai-knowledge/:id
 * Actualizar recurso de conocimiento
 */
router.put('/:id', upload.single('file'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, content, keywords, media_url, price, active } = req.body;

        // Verificar si existe
        const checkResult = await pool.query('SELECT * FROM ai_knowledge WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Recurso no encontrado' });
        }

        const oldResource = checkResult.rows[0];
        let finalMediaUrl = oldResource.media_url;

        // Si se subió un nuevo archivo o se envió una nueva URL
        if (req.file) {
            const { slug } = getKnowledgeDir();
            finalMediaUrl = slug
                ? `/uploads/${slug}/ai_knowledge/${req.file.filename}`
                : `/uploads/ai_knowledge/${req.file.filename}`;

            // Borrar archivo anterior si existía localmente
            if (oldResource.media_url && oldResource.media_url.startsWith('/uploads')) {
                const oldPath = path.join(__dirname, '../../', oldResource.media_url.substring(1));
                if (fs.existsSync(oldPath)) {
                    fs.unlink(oldPath, (err) => {
                        if (err) console.error('Error borrando archivo anterior:', err);
                    });
                }
            }
        } else if (media_url !== undefined) {
            finalMediaUrl = media_url || null;
            if (media_url && oldResource.media_url && oldResource.media_url.startsWith('/uploads')) {
                const oldPath = path.join(__dirname, '../../', oldResource.media_url.substring(1));
                if (fs.existsSync(oldPath)) {
                    fs.unlink(oldPath, (err) => {
                        if (err) console.error('Error borrando archivo local reemplazado por URL:', err);
                    });
                }
            }
        }

        const keywordArray = keywords ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim())) : oldResource.keywords;
        const priceVal = price !== undefined ? (price === '' || price === null ? null : parseFloat(price)) : oldResource.price;
        const activeVal = active !== undefined ? (active === 'false' || active === false ? false : true) : oldResource.active;

        // Re-generar embedding si cambió el contenido o título
        let embedding = oldResource.embedding;
        if (content !== oldResource.content || title !== oldResource.title) {
            console.log(`🧬 Re-generando embedding para actualización: ${title || 'Sin título'}`);
            const embeddingText = `${title || ''} ${content || ''}`.trim();
            embedding = await getEmbedding(embeddingText);
        }

        const query = `
            UPDATE ai_knowledge 
            SET title = $1, content = $2, keywords = $3, media_url = $4, embedding = $5, price = $6, active = $7, updated_at = NOW()
            WHERE id = $8
            RETURNING *
        `;

        const values = [title ?? oldResource.title, content ?? oldResource.content, keywordArray, finalMediaUrl, embedding, priceVal, activeVal, id];
        const result = await pool.query(query, values);

        res.json(result.rows[0]);
    } catch (error) {
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error borrando archivo tras fallo:', err);
            });
        }
        next(error);
    }
});
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
            const filePath = path.join(config.uploadDir, '../', relativePath);

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

/**
 * GET /api/ai-knowledge/promociones
 * Retorna las promociones del tenant.
 * Query params:
 *   active=true  → solo activas (default: todas)
 *   active=false → solo inactivas
 */
router.get('/promociones', async (req, res, next) => {
    try {
        const { active } = req.query;

        let query = `
            SELECT id, title, content, media_url, active, price, keywords, created_at, updated_at
            FROM ai_knowledge
            WHERE $1 = ANY(keywords)
        `;
        const params = ['promocion'];
        let paramCount = 2;

        // Filtrar por estado activo si se especifica
        if (active !== undefined) {
            query += ` AND active = $${paramCount}`;
            params.push(active === 'true');
            paramCount++;
        }

        query += ' ORDER BY active DESC, created_at DESC';

        const result = await pool.query(query, params);

        const promociones = result.rows.map(row => {
            let imageUrl = row.media_url;
            if (imageUrl && imageUrl.startsWith('/uploads')) {
                imageUrl = `${config.publicUrl}${imageUrl}`;
            }
            return {
                id: row.id,
                nombre: row.title,
                texto: row.content,
                activa: row.active,
                precio: row.price,
                imagen_url: imageUrl || null,
                keywords: row.keywords,
                creado: row.created_at,
                actualizado: row.updated_at
            };
        });

        res.json({
            total: promociones.length,
            activas: promociones.filter(p => p.activa).length,
            inactivas: promociones.filter(p => !p.activa).length,
            promociones
        });
    } catch (error) {
        console.error('❌ Error en GET /api/ai-knowledge/promociones:', error.message);
        next(error);
    }
});

module.exports = router;

