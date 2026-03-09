/**
 * User Management Routes
 * Protected endpoints for admin panel: manage users by sede
 * Roles: SUPER_ADMIN (full access), SEDE_ADMIN (own sede only)
 */
const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────
// MIDDLEWARE: require admin role + extract user
// ─────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }
    const token = authHeader.substring(7);
    const decoded = authService.verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    if (!['SUPER_ADMIN', 'SEDE_ADMIN'].includes(decoded.role)) {
        return res.status(403).json({ error: 'Sin permisos de administrador' });
    }
    req.adminUser = decoded; // { id, username, role, tenants }
    next();
};

// Apply to all routes in this router
router.use(requireAdmin);

// ─────────────────────────────────────────────
// GET /api/admin/users
// List users: if ?sede=slug filter by sede, else all (SUPER_ADMIN only)
// ─────────────────────────────────────────────
router.get('/users', asyncHandler(async (req, res) => {
    const { sede } = req.query;
    const { role, id } = req.adminUser;

    if (sede) {
        // Filter by sede
        const result = await authService.getUsersBySede(sede, role, id);
        if (!result.success) {
            throw new AppError(result.error, result.code || 400);
        }
        return res.json({ success: true, users: result.users, sede: result.sede });
    }

    // No sede filter: only SUPER_ADMIN can see all
    if (role !== 'SUPER_ADMIN') {
        // SEDE_ADMIN without ?sede: return users from their first assigned sede
        const tenants = req.adminUser.tenants || [];
        if (tenants.length === 0) {
            return res.json({ success: true, users: [], sede: null });
        }
        const result = await authService.getUsersBySede(tenants[0], role, id);
        if (!result.success) throw new AppError(result.error, result.code || 400);
        return res.json({ success: true, users: result.users, sede: result.sede });
    }

    const users = await authService.getAllUsersWithSedes();
    res.json({ success: true, users });
}));

// ─────────────────────────────────────────────
// GET /api/admin/tenants
// Get all tenants for dropdowns
// ─────────────────────────────────────────────
router.get('/tenants', asyncHandler(async (req, res) => {
    const tenants = await authService.getAllTenants();
    res.json({ success: true, tenants });
}));

// ─────────────────────────────────────────────
// POST /api/admin/users
// Create a user and assign to sede
// Body: { username, password, name, email?, role, sede }
// ─────────────────────────────────────────────
router.post('/users', asyncHandler(async (req, res) => {
    const { username, password, name, email, role, sede } = req.body;
    const { role: callerRole, id: callerId } = req.adminUser;

    if (!username || !password || !name || !sede) {
        throw new AppError('Faltan campos requeridos: username, password, name, sede', 400);
    }

    const result = await authService.createUserForSede(
        { username, password, name, email, role },
        sede,
        callerRole,
        callerId
    );

    if (!result.success) {
        throw new AppError(result.error, result.code || 400);
    }

    res.status(201).json({ success: true, user: result.user });
}));

// ─────────────────────────────────────────────
// PATCH /api/admin/users/:id/status
// Toggle active/inactive
// Body: { isActive: true|false }
// ─────────────────────────────────────────────
router.patch('/users/:id/status', asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const { isActive } = req.body;
    const { role: callerRole, id: callerId } = req.adminUser;

    if (typeof isActive !== 'boolean') {
        throw new AppError('El campo isActive debe ser true o false', 400);
    }

    const result = await authService.updateUserStatus(userId, isActive, callerRole, callerId);
    if (!result.success) {
        throw new AppError(result.error, result.code || 400);
    }

    res.json({ success: true, message: isActive ? 'Usuario activado' : 'Usuario desactivado' });
}));

// ─────────────────────────────────────────────
// DELETE /api/admin/users/:id
// Hard delete a user
// ─────────────────────────────────────────────
router.delete('/users/:id', asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const { role: callerRole, id: callerId } = req.adminUser;

    const result = await authService.deleteUser(userId, callerRole, callerId);
    if (!result.success) {
        throw new AppError(result.error, result.code || 400);
    }

    res.json({ success: true, message: 'Usuario eliminado' });
}));

// ─────────────────────────────────────────────
// POST /api/admin/tenants/test-connection
// Test a DB URL before creating the sede (SUPER_ADMIN only)
// Body: { dbUrl }
// ─────────────────────────────────────────────
router.post('/tenants/test-connection', asyncHandler(async (req, res) => {
    if (req.adminUser.role !== 'SUPER_ADMIN') {
        throw new AppError('Solo SUPER_ADMIN puede gestionar sedes', 403);
    }
    const { dbUrl } = req.body;
    if (!dbUrl) throw new AppError('Se requiere la URL de la base de datos', 400);

    const { Pool } = require('pg');
    const testPool = new Pool({
        connectionString: dbUrl,
        ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
            ? false
            : { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
        max: 1
    });

    try {
        const client = await testPool.connect();
        await client.query('SELECT 1');
        client.release();
        await testPool.end();
        res.json({ success: true, message: 'Conexión exitosa' });
    } catch (err) {
        await testPool.end().catch(() => { });
        res.status(400).json({ success: false, error: `No se pudo conectar: ${err.message}` });
    }
}));

// ─────────────────────────────────────────────
// POST /api/admin/tenants/evolution/create
// Create a new instance in Evolution API (SUPER_ADMIN only)
// Body: { instanceName }
// ─────────────────────────────────────────────
router.post('/tenants/evolution/create', asyncHandler(async (req, res) => {
    if (req.adminUser.role !== 'SUPER_ADMIN') {
        throw new AppError('Solo SUPER_ADMIN puede realizar esta acción', 403);
    }
    const { instanceName } = req.body;
    if (!instanceName) throw new AppError('Se requiere el nombre de la instancia', 400);

    const evolutionService = require('../services/evolutionService');
    const result = await evolutionService.createInstance(instanceName);

    if (!result.success) {
        throw new AppError(result.error, 400);
    }

    res.json({ success: true, instance: result.instance });
}));

// ─────────────────────────────────────────────
// GET /api/admin/tenants/evolution/qr/:instanceName
// Get QR code for an instance (SUPER_ADMIN only)
// ─────────────────────────────────────────────
router.get('/tenants/evolution/qr/:instanceName', asyncHandler(async (req, res) => {
    if (req.adminUser.role !== 'SUPER_ADMIN') {
        throw new AppError('Solo SUPER_ADMIN puede realizar esta acción', 403);
    }
    const { instanceName } = req.params;

    const evolutionService = require('../services/evolutionService');
    const result = await evolutionService.getQR(instanceName);

    if (!result.success) {
        throw new AppError(result.error, 400);
    }

    res.json(result);
}));

// ─────────────────────────────────────────────
// GET /api/admin/tenants/evolution/status/:instanceName
// Check if an Evolution instance is connected (SUPER_ADMIN only)
// Returns: { connected: boolean, state: string }
// ─────────────────────────────────────────────
router.get('/tenants/evolution/status/:instanceName', asyncHandler(async (req, res) => {
    if (req.adminUser.role !== 'SUPER_ADMIN') {
        throw new AppError('Solo SUPER_ADMIN puede realizar esta acción', 403);
    }
    const { instanceName } = req.params;
    const evolutionService = require('../services/evolutionService');

    try {
        const url = `${evolutionService.baseUrl}/instance/connectionState/${instanceName}`;
        const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
        const response = await fetch(url, {
            headers: { 'apikey': evolutionService.globalApiKey }
        });
        const data = await response.json();

        // Evolution v2 returns: { instance: { state: "open" | "connecting" | "close" } }
        const state = data?.instance?.state || data?.state || data?.status || '';
        const connected = state === 'open' || state === 'CONNECTED' || state === 'connected';

        res.json({ success: true, connected, state });
    } catch (err) {
        res.json({ success: false, connected: false, state: 'unknown', error: err.message });
    }
}));

// ─────────────────────────────────────────────
// POST /api/admin/tenants
// Create a new sede/tenant (SUPER_ADMIN only)
// Body: { name, slug, dbUrl, evolutionInstance?, evolutionApiKey?, n8nWebhookUrl? }
// ─────────────────────────────────────────────
router.post('/tenants', asyncHandler(async (req, res) => {
    if (req.adminUser.role !== 'SUPER_ADMIN') {
        throw new AppError('Solo SUPER_ADMIN puede crear sedes', 403);
    }

    const { name, slug, dbUrl, whatsappProvider, waPhoneNumberId, waAccessToken, waVerifyToken, evolutionInstance, evolutionApiKey, n8nWebhookUrl } = req.body;
    if (!name || !slug || !dbUrl) {
        throw new AppError('Faltan campos requeridos: name, slug, dbUrl', 400);
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
        throw new AppError('El slug solo puede contener letras minúsculas, números y guiones', 400);
    }

    const masterPool = require('../config/database').dbManager.masterPool;

    // Check slug uniqueness
    const { rows: existing } = await masterPool.query(
        'SELECT id FROM tenants WHERE slug = $1', [slug]
    );
    if (existing.length > 0) {
        throw new AppError(`Ya existe una sede con el slug "${slug}"`, 409);
    }

    // --- 1. PROVISIONING TEANT DATABASE ---
    const fs = require('fs');
    const path = require('path');
    const { Pool } = require('pg');

    try {
        const schemaPath = path.join(__dirname, '../../schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        const tempPool = new Pool({
            connectionString: dbUrl,
            ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
        });

        console.log(`📡 Initializing schema for new tenant at: ${dbUrl}`);
        await tempPool.query(schemaSql);
        await tempPool.end();
        console.log(`✅ Schema initialized successfully for ${slug}`);
    } catch (err) {
        console.error('❌ Tenant Database Provisioning Failed:', err);
        throw new AppError(`No se pudo inicializar la base de datos de la sede: ${err.message}`, 500);
    }

    // --- 2. RECORD IN MASTER DB ---
    const { rows } = await masterPool.query(
        `INSERT INTO tenants (name, slug, db_url, whatsapp_provider, wa_phone_number_id, wa_access_token, wa_verify_token, evolution_instance, evolution_api_key, n8n_webhook_url, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
         RETURNING id, name, slug, whatsapp_provider, evolution_instance, is_active, created_at`,
        [name, slug, dbUrl, whatsappProvider || 'evolution', waPhoneNumberId || null, waAccessToken || null, waVerifyToken || null, evolutionInstance || null, evolutionApiKey || null, n8nWebhookUrl || null]
    );

    res.status(201).json({ success: true, tenant: rows[0] });
}));

// ─────────────────────────────────────────────
// POST /api/admin/tenants/evolution/setup
// Create instance + configure webhook in ONE step (SUPER_ADMIN only)
// Body: { instanceName, webhookBaseUrl }
// ─────────────────────────────────────────────
router.post('/tenants/evolution/setup', asyncHandler(async (req, res) => {
    if (req.adminUser.role !== 'SUPER_ADMIN') {
        throw new AppError('Solo SUPER_ADMIN puede realizar esta acción', 403);
    }
    const { instanceName, webhookBaseUrl } = req.body;
    if (!instanceName) throw new AppError('Se requiere instanceName', 400);

    const evolutionService = require('../services/evolutionService');

    // Step 1: Create instance (ignore "already exists" errors)
    const createResult = await evolutionService.createInstance(instanceName);
    if (!createResult.success) {
        const errStr = (createResult.error || '').toLowerCase();
        if (!errStr.includes('already exists') && !errStr.includes('ya existe') && !errStr.includes('conflict')) {
            throw new AppError(`Error al crear instancia: ${createResult.error}`, 400);
        }
        console.log(`ℹ️ Instance ${instanceName} already exists, continuing with webhook setup...`);
    }

    // Step 2: Configure webhook
    const webhookUrl = `${webhookBaseUrl}/evolution`;
    const whResult = await evolutionService.setWebhook(instanceName, webhookUrl);

    // Step 3: Get QR
    const qrResult = await evolutionService.getQR(instanceName);

    res.json({
        success: true,
        instanceCreated: createResult.success,
        webhookConfigured: whResult.success,
        webhookUrl,
        qr: qrResult.qr || null,
        warnings: [
            !whResult.success ? `Webhook no pudo configurarse: ${whResult.error}` : null
        ].filter(Boolean)
    });
}));

// ─────────────────────────────────────────────
// POST /api/admin/tenants/evolution/set-webhook
// Configure webhook for an existing instance
// Body: { instanceName, webhookBaseUrl }
// ─────────────────────────────────────────────
router.post('/tenants/evolution/set-webhook', asyncHandler(async (req, res) => {
    if (req.adminUser.role !== 'SUPER_ADMIN') {
        throw new AppError('Solo SUPER_ADMIN puede realizar esta acción', 403);
    }
    const { instanceName, webhookBaseUrl } = req.body;
    if (!instanceName || !webhookBaseUrl) throw new AppError('Se requiere instanceName y webhookBaseUrl', 400);

    const evolutionService = require('../services/evolutionService');
    const webhookUrl = `${webhookBaseUrl}/evolution`;
    const result = await evolutionService.setWebhook(instanceName, webhookUrl);

    if (!result.success) throw new AppError(`Error configurando webhook: ${result.error}`, 400);
    res.json({ success: true, webhookUrl });
}));

// ─────────────────────────────────────────────
// POST /api/admin/tenants/:slug/sync-conversations
// Import historical conversations from Evolution into tenant DB
// Body: none required (uses tenant slug → instance from master DB)
// ─────────────────────────────────────────────
router.post('/tenants/:slug/sync-conversations', asyncHandler(async (req, res) => {
    if (req.adminUser.role !== 'SUPER_ADMIN') {
        throw new AppError('Solo SUPER_ADMIN puede sincronizar sedes', 403);
    }

    const { slug } = req.params;
    const masterPool = require('../config/database').dbManager.masterPool;

    // Get tenant from master DB
    const { rows: tenantRows } = await masterPool.query(
        'SELECT * FROM tenants WHERE slug = $1 AND is_active = true', [slug]
    );
    if (tenantRows.length === 0) throw new AppError('Sede no encontrada o inactiva', 404);
    const tenant = tenantRows[0];

    if (!tenant.evolution_instance) {
        throw new AppError('La sede no tiene una instancia de Evolution configurada', 400);
    }

    // Get tenant's DB pool
    const { Pool } = require('pg');
    const { normalizePhone } = require('../utils/phoneUtils');
    const evolutionService = require('../services/evolutionService');

    const tenantPool = new Pool({
        connectionString: tenant.db_url,
        ssl: tenant.db_url.includes('localhost') || tenant.db_url.includes('127.0.0.1')
            ? false : { rejectUnauthorized: false },
        max: 5
    });

    try {
        // 1. Fetch chats from Evolution
        const { success, chats, error } = await evolutionService.fetchChats(tenant.evolution_instance);

        if (!success) {
            throw new AppError(`No se pudieron obtener chats de Evolution: ${error}`, 500);
        }

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        // 2. Import each chat into tenant DB (only individual chats, not groups in a first pass)
        for (const chat of chats) {
            try {
                // Extract phone from JID (e.g. "573152345678@s.whatsapp.net")
                const jid = chat.id || chat.remoteJid || '';
                if (!jid || jid.includes('@g.us') || jid.includes('@broadcast')) {
                    skipped++;
                    continue; // Skip groups and broadcast lists for now
                }

                const phone = normalizePhone(jid);
                if (!phone || phone.length < 7) { skipped++; continue; }

                const contactName = chat.name || chat.pushName || `Usuario ${phone.slice(-4)}`;
                const lastMsg = chat.lastMessage?.message?.conversation ||
                    chat.lastMessage?.message?.extendedTextMessage?.text ||
                    (chat.lastMessage?.message?.imageMessage ? '📷 Imagen' : null) ||
                    (chat.lastMessage?.message?.audioMessage ? '🎤 Audio' : null) ||
                    (chat.lastMessage?.message?.videoMessage ? '🎥 Video' : null) ||
                    null;

                const lastMsgTs = chat.lastMessage?.messageTimestamp
                    ? new Date(chat.lastMessage.messageTimestamp * 1000).toISOString()
                    : null;

                const unread = typeof chat.unreadCount === 'number' ? Math.max(0, chat.unreadCount) : 0;

                // Upsert conversation in tenant DB (don't overwrite existing ai_enabled setting)
                await tenantPool.query(`
                    INSERT INTO conversations 
                        (phone, contact_name, last_message_text, last_message_timestamp, unread_count, ai_enabled, conversation_state, status, created_at, updated_at)
                    VALUES 
                        ($1, $2, $3, $4, $5, false, 'agent_active', 'active', NOW(), NOW())
                    ON CONFLICT (phone) DO UPDATE SET
                        contact_name = CASE 
                            WHEN conversations.contact_name IS NULL OR conversations.contact_name = '' 
                                 OR conversations.contact_name LIKE 'Usuario %'
                            THEN EXCLUDED.contact_name
                            ELSE conversations.contact_name
                        END,
                        last_message_text = COALESCE(EXCLUDED.last_message_text, conversations.last_message_text),
                        last_message_timestamp = COALESCE(EXCLUDED.last_message_timestamp, conversations.last_message_timestamp),
                        updated_at = NOW()
                `, [phone, contactName, lastMsg, lastMsgTs, unread]);

                imported++;
            } catch (chatErr) {
                console.error(`❌ Error importing chat ${chat.id}:`, chatErr.message);
                errors++;
            }
        }

        await tenantPool.end();

        console.log(`✅ Sync complete for [${slug}]: ${imported} imported, ${skipped} skipped, ${errors} errors`);

        res.json({
            success: true,
            total: chats.length,
            imported,
            skipped,
            errors
        });
    } catch (err) {
        await tenantPool.end().catch(() => { });
        throw err;
    }
}));

// ─────────────────────────────────────────────
// PATCH /api/admin/tenants/:id/status
// Activate / deactivate a sede (SUPER_ADMIN only)
// ─────────────────────────────────────────────
router.patch('/tenants/:id/status', asyncHandler(async (req, res) => {
    if (req.adminUser.role !== 'SUPER_ADMIN') {
        throw new AppError('Solo SUPER_ADMIN puede modificar sedes', 403);
    }
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') throw new AppError('isActive debe ser true o false', 400);

    const masterPool = require('../config/database').dbManager.masterPool;
    const { rows } = await masterPool.query(
        'UPDATE tenants SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, is_active',
        [isActive, req.params.id]
    );
    if (rows.length === 0) throw new AppError('Sede no encontrada', 404);
    res.json({ success: true, tenant: rows[0] });
}));

module.exports = router;

