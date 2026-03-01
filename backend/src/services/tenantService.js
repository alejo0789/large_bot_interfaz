/**
 * Tenant Service
 * Handles metadata for different sites (tenants)
 */
const { dbManager } = require('../config/database');

class TenantService {
    async getTenantBySlug(slug) {
        const { rows } = await dbManager.masterPool.query(
            'SELECT id, name, slug, db_url, evolution_instance, evolution_api_key, n8n_webhook_url FROM tenants WHERE slug = $1 AND is_active = TRUE',
            [slug]
        );
        return rows[0];
    }

    async getTenantById(id) {
        const { rows } = await dbManager.masterPool.query(
            'SELECT id, name, slug, db_url FROM tenants WHERE id = $1 AND is_active = TRUE',
            [id]
        );
        return rows[0];
    }

    async getAllTenants() {
        const { rows } = await dbManager.masterPool.query(
            'SELECT id, name, slug, evolution_instance, is_active FROM tenants ORDER BY name'
        );
        return rows;
    }
}

module.exports = new TenantService();
