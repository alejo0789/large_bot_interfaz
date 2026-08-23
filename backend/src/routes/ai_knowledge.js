const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { pool, dbManager } = require('../config/database');
const { config } = require('../config/app');
const { tenantContext } = require('../utils/tenantContext');

// Helper to ensure global knowledge base table exists in Master DB
async function ensureGlobalTable() {
    try {
        if (!dbManager || !dbManager.masterPool) return;
        await dbManager.masterPool.query(`
            CREATE TABLE IF NOT EXISTS ai_knowledge_global (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                type VARCHAR(20) NOT NULL,
                title VARCHAR(255),
                content TEXT,
                media_url TEXT,
                filename VARCHAR(255),
                keywords TEXT[],
                price NUMERIC(12,2),
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `).catch(() => {});
        
        await dbManager.masterPool.query(`
            ALTER TABLE ai_knowledge_global ADD COLUMN IF NOT EXISTS embedding vector(3072);
        `).catch(() => {});
    } catch (e) {
        console.warn('⚠️ Error asegurando ai_knowledge_global:', e.message);
    }
}
ensureGlobalTable();

// Helper to select target pool and table name based on global query param or header
function getKnowledgeContext(req) {
    const isGlobal = req.query.global === 'true' || req.query.is_global === 'true' || req.headers['x-is-global'] === 'true';
    if (isGlobal && dbManager && dbManager.masterPool) {
        return {
            activePool: dbManager.masterPool,
            tableName: 'ai_knowledge_global',
            isGlobal: true
        };
    }
    return {
        activePool: req.db || pool,
        tableName: 'ai_knowledge',
        isGlobal: false
    };
}

// Helper to get tenant-specific knowledge upload directory
const getKnowledgeDir = (req) => {
    let slug = req?.tenant?.slug;
    if (!slug) {
        const context = tenantContext.getStore();
        slug = context?.tenant?.slug;
    }

    let baseDir = config.uploadDir;
    if (slug) {
        baseDir = path.join(config.uploadDir, slug);
    }

    const kDir = path.join(baseDir, 'ai_knowledge');

    try {
        if (!fs.existsSync(kDir)) {
            fs.mkdirSync(kDir, { recursive: true });
        }
    } catch (err) {
        console.error(`❌ [AI Knowledge] Error creando directorio ${kDir}:`, err.message);
        throw err;
    }
    return { dir: kDir, slug };
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        try {
            const { dir } = getKnowledgeDir(req);
            cb(null, dir);
        } catch (err) {
            cb(err);
        }
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
        if (file.mimetype.startsWith('image/') ||
            file.mimetype.startsWith('audio/') ||
            file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Formato de archivo no soportado. Solo imágenes, audios y videos.'), false);
        }
    }
});

// Helper para comprimir/optimizar imágenes subidas si superan los 4MB (límite Meta 5MB)
async function processUploadedImage(req) {
    if (!req.file || !req.file.mimetype.startsWith('image/')) return;

    try {
        const filePath = req.file.path;
        if (!fs.existsSync(filePath)) return;

        const stats = fs.statSync(filePath);
        const maxBytes = 4 * 1024 * 1024; // 4 MB threshold

        if (stats.size > maxBytes) {
            console.log(`🖼️ [AI Knowledge Upload] Optimizando imagen subida (${(stats.size / (1024 * 1024)).toFixed(2)}MB > 4MB)...`);

            const tempPath = filePath + '_compressed.jpg';

            await sharp(filePath)
                .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 82 })
                .toFile(tempPath);

            fs.unlinkSync(filePath);
            fs.renameSync(tempPath, filePath);

            const newStats = fs.statSync(filePath);
            console.log(`✅ [AI Knowledge Upload] Imagen reducida exitosamente a ${(newStats.size / (1024 * 1024)).toFixed(2)}MB`);
            req.file.size = newStats.size;
        }
    } catch (err) {
        console.error('❌ [AI Knowledge Upload] Error comprimiendo imagen:', err.message);
    }
}

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Función para generar embeddings automáticamente
async function getEmbedding(text) {
    const API_KEY = process.env.GOOGLE_AI_API_KEY;
    if (!API_KEY) {
        return null;
    }

    if (!text || !text.trim()) {
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

// Helper to check if embedding column exists in the database
async function checkEmbeddingColumn(poolInstance, tableName = 'ai_knowledge') {
    try {
        const checkCol = await poolInstance.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name=$1 AND column_name='embedding'
        `, [tableName]);
        return checkCol.rows.length > 0;
    } catch (e) {
        return false;
    }
}

/**
 * GET /api/ai-knowledge
 * Listar recursos de conocimiento
 * Query params: type (image, video, audio, text), active (true/false), global (true/false)
 */
router.get('/', async (req, res, next) => {
    try {
        const { type, active } = req.query;
        const { activePool, tableName, isGlobal } = getKnowledgeContext(req);

        let query = `SELECT * FROM ${tableName} WHERE 1=1`;
        const params = [];
        let paramCount = 1;

        if (type) {
            query += ` AND type = $${paramCount}`;
            params.push(type);
            paramCount++;
            if (type === 'text') {
                query += ` AND (keywords IS NULL OR NOT ('info_sede' = ANY(keywords)))`;
            }
        } else {
            query += ` AND (keywords IS NULL OR NOT ('info_sede' = ANY(keywords))) AND type != 'sede'`;
        }

        if (active !== undefined) {
            query += ` AND active = $${paramCount}`;
            params.push(active === 'true');
            paramCount++;
        }

        query += ' ORDER BY created_at DESC';

        const result = await activePool.query(query, params);

        let globalRows = [];
        if (!isGlobal && dbManager && dbManager.masterPool) {
            try {
                const globalQuery = query.replace(`FROM ${tableName}`, 'FROM ai_knowledge_global');
                const globalResult = await dbManager.masterPool.query(globalQuery, params);
                globalRows = globalResult.rows.map(r => ({ ...r, is_global: true }));
            } catch(err) {
                // Ignore if global table not yet populated
            }
        }

        const allRows = [...globalRows, ...result.rows];

        const resources = allRows.map(row => {
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
        console.error('❌ Error en GET /api/ai-knowledge:', error.message);
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

        await processUploadedImage(req);

        const { description, keywords, title, price, active } = req.body;
        const { activePool, tableName } = getKnowledgeContext(req);

        if (tableName === 'ai_knowledge_global' && req.user && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'No tienes permisos para crear productos globales.' });
        }

        const descriptionVal = description || req.body.content || '';
        let type = 'image';
        if (req.file.mimetype.startsWith('audio/')) type = 'audio';
        if (req.file.mimetype.startsWith('video/')) type = 'video';

        const { slug } = getKnowledgeDir(req);
        const mediaUrl = slug
            ? `/uploads/${slug}/ai_knowledge/${req.file.filename}`
            : `/uploads/ai_knowledge/${req.file.filename}`;
        const keywordArray = keywords ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim())) : [];

        const embeddingText = `${title || ''} ${descriptionVal}`.trim();
        let embedding = null;
        try { embedding = await getEmbedding(embeddingText); } catch (e) { console.warn('⚠️ Embedding no generado:', e.message); }

        const priceVal = price ? parseFloat(price) : null;
        const activeVal = active === 'false' ? false : true;

        const hasEmbedCol = await checkEmbeddingColumn(activePool, tableName);
        let columns = '(type, title, content, media_url, filename, keywords, price, active)';
        let placeholders = 'VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';
        let values = [type, title || '', descriptionVal, mediaUrl, req.file.originalname, keywordArray, priceVal, activeVal];
        if (embedding && hasEmbedCol) {
            columns = '(type, title, content, media_url, filename, keywords, embedding, price, active)';
            placeholders = 'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)';
            values = [type, title || '', descriptionVal, mediaUrl, req.file.originalname, keywordArray, embedding, priceVal, activeVal];
        }

        const result = await activePool.query(`INSERT INTO ${tableName} ${columns} ${placeholders} RETURNING *`, values);
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
        const { activePool, tableName } = getKnowledgeContext(req);

        if (tableName === 'ai_knowledge_global' && req.user && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'No tienes permisos para crear productos globales.' });
        }

        if (!content) {
            return res.status(400).json({ error: 'El contenido es obligatorio' });
        }

        let finalMediaUrl = null;
        if (req.file) {
            await processUploadedImage(req);
            const { slug } = getKnowledgeDir(req);
            finalMediaUrl = slug
                ? `/uploads/${slug}/ai_knowledge/${req.file.filename}`
                : `/uploads/ai_knowledge/${req.file.filename}`;
        } else if (media_url) {
            finalMediaUrl = media_url;
        }

        const keywordArray = keywords ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim())) : [];
        const priceVal = price ? parseFloat(price) : null;
        const activeVal = active === 'false' ? false : true;

        const embeddingText = `${title || ''} ${content || ''}`.trim();
        let embedding = null;
        try {
            embedding = await getEmbedding(embeddingText);
        } catch (e) { console.warn('⚠️ Embedding no generado:', e.message); }

        const hasEmbedCol = await checkEmbeddingColumn(activePool, tableName);
        let columns = '(type, title, content, keywords, media_url, price, active)';
        let placeholders = 'VALUES ($1, $2, $3, $4, $5, $6, $7)';
        let values = ['text', title || '', content, keywordArray, finalMediaUrl, priceVal, activeVal];
        if (embedding && hasEmbedCol) {
            columns = '(type, title, content, keywords, embedding, media_url, price, active)';
            placeholders = 'VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';
            values = ['text', title || '', content, keywordArray, embedding, finalMediaUrl, priceVal, activeVal];
        }

        const result = await activePool.query(`INSERT INTO ${tableName} ${columns} ${placeholders} RETURNING *`, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
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
        let { activePool, tableName, isGlobal } = getKnowledgeContext(req);

        let checkResult = await activePool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
        if (checkResult.rows.length === 0 && !isGlobal && dbManager && dbManager.masterPool) {
            const globalCheck = await dbManager.masterPool.query('SELECT * FROM ai_knowledge_global WHERE id = $1', [id]);
            if (globalCheck.rows.length > 0) {
                activePool = dbManager.masterPool;
                tableName = 'ai_knowledge_global';
                checkResult = globalCheck;
            }
        }

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Recurso no encontrado' });
        }

        if (tableName === 'ai_knowledge_global' && req.user && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'No tienes permisos para editar productos globales.' });
        }

        const oldResource = checkResult.rows[0];
        let finalMediaUrl = oldResource.media_url;

        if (req.file) {
            await processUploadedImage(req);
            const { slug } = getKnowledgeDir(req);
            finalMediaUrl = slug
                ? `/uploads/${slug}/ai_knowledge/${req.file.filename}`
                : `/uploads/ai_knowledge/${req.file.filename}`;

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

        let embeddingUpdate = null;
        if ((content !== undefined && content !== oldResource.content) || (title !== undefined && title !== oldResource.title)) {
            try {
                const embeddingText = `${title || ''} ${content || ''}`.trim();
                embeddingUpdate = await getEmbedding(embeddingText);
            } catch (e) { console.warn('⚠️ Embedding no re-generado:', e.message); }
        }

        const hasEmbedCol = await checkEmbeddingColumn(activePool, tableName);
        const setClauses = [
            'title = $1', 'content = $2', 'keywords = $3',
            'media_url = $4', 'price = $5', 'active = $6', 'updated_at = NOW()'
        ];
        const values = [title ?? oldResource.title, content ?? oldResource.content, keywordArray, finalMediaUrl, priceVal, activeVal];
        let paramIdx = 7;

        if (embeddingUpdate && hasEmbedCol) {
            setClauses.splice(4, 0, `embedding = $${paramIdx}`);
            values.splice(4, 0, embeddingUpdate);
            paramIdx++;
        }

        values.push(id);
        const result = await activePool.query(
            `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
            values
        );

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

/**
 * DELETE /api/ai-knowledge/:id
 */
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        let { activePool, tableName, isGlobal } = getKnowledgeContext(req);

        let checkResult = await activePool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
        if (checkResult.rows.length === 0 && !isGlobal && dbManager && dbManager.masterPool) {
            const globalCheck = await dbManager.masterPool.query('SELECT * FROM ai_knowledge_global WHERE id = $1', [id]);
            if (globalCheck.rows.length > 0) {
                activePool = dbManager.masterPool;
                tableName = 'ai_knowledge_global';
                checkResult = globalCheck;
            }
        }

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Recurso no encontrado' });
        }

        if (tableName === 'ai_knowledge_global' && req.user && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'No tienes permisos para eliminar productos globales.' });
        }

        const resource = checkResult.rows[0];

        await activePool.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);

        if (resource.media_url) {
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
 */
router.get('/promociones', async (req, res, next) => {
    try {
        const { active } = req.query;
        const { activePool, tableName, isGlobal } = getKnowledgeContext(req);

        let query = `
            SELECT id, title, content, media_url, active, price, keywords, created_at, updated_at
            FROM ${tableName}
            WHERE $1 = ANY(keywords)
        `;
        const params = ['promocion'];
        let paramCount = 2;

        if (active !== undefined) {
            query += ` AND active = $${paramCount}`;
            params.push(active === 'true');
            paramCount++;
        }

        query += ' ORDER BY active DESC, created_at DESC';

        const result = await activePool.query(query, params);

        let globalRows = [];
        if (!isGlobal && dbManager && dbManager.masterPool) {
            try {
                const globalQuery = query.replace(`FROM ${tableName}`, 'FROM ai_knowledge_global');
                const globalResult = await dbManager.masterPool.query(globalQuery, params);
                globalRows = globalResult.rows.map(r => ({ ...r, is_global: true }));
            } catch(err) {}
        }

        const allRows = [...globalRows, ...result.rows];

        const promociones = allRows.map(row => {
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
                is_global: row.is_global || false,
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

/**
 * GET /api/ai-knowledge/servicios
 */
router.get('/servicios', async (req, res, next) => {
    try {
        const { active } = req.query;
        const { activePool, tableName, isGlobal } = getKnowledgeContext(req);

        let query = `
            SELECT id, title, content, media_url, active, price, keywords, created_at, updated_at
            FROM ${tableName}
            WHERE $1 = ANY(keywords)
        `;
        const params = ['servicio'];
        let paramCount = 2;

        if (active !== undefined) {
            query += ` AND active = $${paramCount}`;
            params.push(active === 'true');
            paramCount++;
        }

        query += ' ORDER BY active DESC, created_at DESC';

        const result = await activePool.query(query, params);

        let globalRows = [];
        if (!isGlobal && dbManager && dbManager.masterPool) {
            try {
                const globalQuery = query.replace(`FROM ${tableName}`, 'FROM ai_knowledge_global');
                const globalResult = await dbManager.masterPool.query(globalQuery, params);
                globalRows = globalResult.rows.map(r => ({ ...r, is_global: true }));
            } catch(err) {}
        }

        const allRows = [...globalRows, ...result.rows];

        const servicios = allRows.map(row => {
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
                is_global: row.is_global || false,
                creado: row.created_at,
                actualizado: row.updated_at
            };
        });

        res.json(servicios);
    } catch (error) {
        console.error('❌ Error en GET /api/ai-knowledge/servicios:', error.message);
        next(error);
    }
});

/**
 * GET /api/ai-knowledge/sede
 */
router.get('/sede', async (req, res, next) => {
    try {
        const { activePool, tableName } = getKnowledgeContext(req);
        if (!activePool) return res.json([]);
        const query = `
            SELECT id, title, content, keywords, active, created_at, updated_at
            FROM ${tableName}
            WHERE (keywords IS NOT NULL AND 'info_sede' = ANY(keywords)) OR type = 'sede'
            ORDER BY created_at ASC
        `;
        const result = await activePool.query(query);

        res.json(result.rows || []);
    } catch (error) {
        console.error('❌ Error en GET /api/ai-knowledge/sede:', error.message);
        res.json([]);
    }
});

/**
 * POST /api/ai-knowledge/sede
 */
router.post('/sede', async (req, res, next) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'Formato inválido. Se requiere un array "items".' });
        }

        const { activePool, tableName } = getKnowledgeContext(req);

        if (tableName === 'ai_knowledge_global' && req.user && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'No tienes permisos para modificar productos globales.' });
        }

        const hasEmbedCol = await checkEmbeddingColumn(activePool, tableName);
        const savedItems = [];

        for (const item of items) {
            const { id, title, content, sub_type } = item;
            if (!title || !title.trim()) continue;

            const keywords = ['info_sede'];
            if (sub_type) keywords.push(sub_type);

            const embeddingText = `${title} ${content || ''}`.trim();
            let embedding = null;
            try {
                embedding = await getEmbedding(embeddingText);
            } catch (e) {
                console.warn(`⚠️ Embedding no generado para ${title}:`, e.message);
            }

            if (id) {
                let updateQuery = `
                    UPDATE ${tableName} 
                    SET type = 'sede', title = $1, content = $2, keywords = $3, updated_at = NOW()
                `;
                let values = [title, content || '', keywords];
                let valIdx = 4;

                if (embedding && hasEmbedCol) {
                    updateQuery += `, embedding = $${valIdx}`;
                    values.push(embedding);
                    valIdx++;
                }

                updateQuery += ` WHERE id = $${valIdx} RETURNING *`;
                values.push(id);

                const upRes = await activePool.query(updateQuery, values);
                if (upRes.rows.length > 0) savedItems.push(upRes.rows[0]);
            } else {
                let columns = '(type, title, content, keywords, active)';
                let placeholders = 'VALUES ($1, $2, $3, $4, $5)';
                let values = ['sede', title, content || '', keywords, true];

                if (embedding && hasEmbedCol) {
                    columns = '(type, title, content, keywords, active, embedding)';
                    placeholders = 'VALUES ($1, $2, $3, $4, $5, $6)';
                    values.push(embedding);
                }

                const insRes = await activePool.query(
                    `INSERT INTO ${tableName} ${columns} ${placeholders} RETURNING *`,
                    values
                );
                savedItems.push(insRes.rows[0]);
            }
        }

        res.json({ success: true, count: savedItems.length, items: savedItems });
    } catch (error) {
        console.error('❌ Error en POST /api/ai-knowledge/sede:', error.message);
        next(error);
    }
});

/**
 * POST /api/ai-knowledge/sync-embeddings
 * Regenerate embeddings for all rows that are missing them.
 * Works on both tenant-specific and global tables.
 */
router.post('/sync-embeddings', async (req, res, next) => {
    try {
        const { activePool, tableName } = getKnowledgeContext(req);
        const hasEmbedCol = await checkEmbeddingColumn(activePool, tableName);

        if (!hasEmbedCol) {
            return res.status(400).json({ error: 'La columna embedding no existe en esta tabla.' });
        }

        const { rows } = await activePool.query(
            `SELECT id, title, content FROM ${tableName} WHERE embedding IS NULL`
        );

        if (rows.length === 0) {
            return res.json({ success: true, message: 'Todos los registros ya tienen embedding.', synced: 0 });
        }

        let synced = 0;
        let errors = 0;
        const errorDetails = [];

        for (const row of rows) {
            const text = `${row.title || ''} ${row.content || ''}`.trim();
            if (!text) continue;

            try {
                const embedding = await getEmbedding(text);
                if (embedding) {
                    await activePool.query(
                        `UPDATE ${tableName} SET embedding = $1, updated_at = NOW() WHERE id = $2`,
                        [embedding, row.id]
                    );
                    synced++;
                }
            } catch (err) {
                errors++;
                errorDetails.push({ id: row.id, title: row.title, error: err.message });
            }
        }

        res.json({
            success: true,
            total: rows.length,
            synced,
            errors,
            errorDetails: errorDetails.length > 0 ? errorDetails : undefined
        });
    } catch (error) {
        console.error('❌ Error en POST /api/ai-knowledge/sync-embeddings:', error.message);
        next(error);
    }
});

module.exports = router;
