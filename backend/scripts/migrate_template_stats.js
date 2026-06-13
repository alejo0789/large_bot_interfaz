const { dbManager } = require('../src/config/database');
const tenantService = require('../src/services/tenantService');

(async () => {
    try {
        const tenants = await tenantService.getAllTenants();
        for (const t of tenants) {
            if (!t.is_active) continue;
            try {
                // Obtenemos el pool (esto inicializa la DB si aún no está en cache)
                const pool = await dbManager.getPool(t.id, t.db_url || null);
                if (pool) {
                    await pool.query(`
                        CREATE TABLE IF NOT EXISTS official_template_stats (
                            id SERIAL PRIMARY KEY,
                            template_name VARCHAR(255),
                            sent_count INT DEFAULT 0,
                            failed_count INT DEFAULT 0,
                            sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                        );
                    `);
                    console.log('✅ Created table for', t.slug);
                }
            } catch (e) {
                console.error('❌ Error on', t.slug, e.message);
            }
        }
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
