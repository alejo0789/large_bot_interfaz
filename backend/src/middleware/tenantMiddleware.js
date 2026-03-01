const { dbManager } = require('../config/database');
const tenantService = require('../services/tenantService');
const { AppError } = require('./errorHandler');
const { tenantContext } = require('../utils/tenantContext');

const tenantMiddleware = async (req, res, next) => {
    try {
        // 1. Get tenant identifier
        const tenantSlug = req.headers['x-sede-slug'] ||
            (req.query && req.query.sede) ||
            (req.body && (req.body.sede || req.body.instance));

        if (!tenantSlug) {
            // Allow health check and authentication routes to bypass tenant check
            // We check both absolute path and internal express path (without /api prefix if mounted there)
            const isPublicRoute =
                req.path.startsWith('/api/auth') ||
                req.path.startsWith('/auth') ||
                req.path === '/health' ||
                req.path === '/api/health' ||
                req.method === 'OPTIONS';

            if (isPublicRoute) {
                req.db = dbManager.masterPool;
                return next();
            }

            console.warn(`⚠️ Sede no especificada para la ruta: ${req.method} ${req.path}. Headers:`, req.headers['x-sede-slug'] ? 'Present' : 'Missing');
            throw new AppError('Sede no especificada', 400);
        }

        // 2. Fetch tenant metadata from Master DB
        const tenant = await tenantService.getTenantBySlugOrInstance(tenantSlug);

        if (!tenant) {
            throw new AppError('Sede no encontrada o inactiva', 404);
        }

        // 3. Get or create the pool for this tenant
        const pool = await dbManager.getPool(tenant.id, tenant.db_url);

        // 4. Run the rest of the request inside the tenant context
        // This makes the pool available to any service using require('database').pool
        tenantContext.run({ tenant, db: pool }, () => {
            // Attach to request object for route-level access if needed
            req.tenant = tenant;
            req.db = pool;
            next();
        });
    } catch (error) {
        next(error);
    }
};

module.exports = tenantMiddleware;
