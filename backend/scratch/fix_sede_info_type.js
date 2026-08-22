const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { dbManager } = require('../src/config/database');

async function fixSedeTypes() {
    try {
        if (!dbManager.masterPool) {
            await dbManager.connectMaster();
        }
        console.log('🔍 Fetching active tenants...');
        const { rows: tenants } = await dbManager.masterPool.query('SELECT id, slug, db_url FROM tenants WHERE is_active = true');
        console.log(`Found ${tenants.length} tenants.`);

        for (const tenant of tenants) {
            console.log(`\n🛠️ Processing tenant: ${tenant.slug}`);
            try {
                const tenantPool = await dbManager.getPool(tenant.id, tenant.db_url);
                const res = await tenantPool.query(`
                    UPDATE ai_knowledge 
                    SET type = 'sede' 
                    WHERE 'info_sede' = ANY(keywords) AND type = 'text'
                    RETURNING id, title
                `);
                console.log(`  ✅ Updated ${res.rowCount} records to type='sede' in tenant ${tenant.slug}`);
            } catch (err) {
                console.error(`  ❌ Error updating ${tenant.slug}:`, err.message);
            }
        }
    } catch (error) {
        console.error('❌ Master Error:', error);
    } finally {
        process.exit(0);
    }
}

fixSedeTypes();
