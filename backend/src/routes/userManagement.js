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
// POST /api/admin/tenants
// Create a new sede/tenant (SUPER_ADMIN only)
// Body: { name, slug, dbUrl, evolutionInstance?, evolutionApiKey?, n8nWebhookUrl? }
// ─────────────────────────────────────────────
router.post('/tenants', asyncHandler(async (req, res) => {
    if (req.adminUser.role !== 'SUPER_ADMIN') {
        throw new AppError('Solo SUPER_ADMIN puede crear sedes', 403);
    }

    const { name, slug, dbUrl, evolutionInstance, evolutionApiKey, n8nWebhookUrl } = req.body;
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
        `INSERT INTO tenants (name, slug, db_url, evolution_instance, evolution_api_key, n8n_webhook_url, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id, name, slug, evolution_instance, is_active, created_at`,
        [name, slug, dbUrl, evolutionInstance || null, evolutionApiKey || null, n8nWebhookUrl || null]
    );

    res.status(201).json({ success: true, tenant: rows[0] });
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
