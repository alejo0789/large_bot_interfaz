const { pool, dbManager } = require('../src/config/database');
const { tenantContext } = require('../src/utils/tenantContext');

async function test() {
    // get master pool
    const res = await dbManager.masterPool.query('SELECT slug, id FROM tenants');
    for (const tenant of res.rows) {
        const tenantPool = await dbManager.getPool(tenant.id, tenant.db_url || process.env.MASTER_DATABASE_URL);
        
        tenantContext.run({ tenant: tenant, db: tenantPool }, async () => {
            const settingsService = require('../src/services/settingsService');
            const val = await settingsService.get('default_ai_enabled');
            console.log(`Tenant ${tenant.slug}: default_ai_enabled =`, val, `(type: ${typeof val})`);
        });
    }
}
test();
