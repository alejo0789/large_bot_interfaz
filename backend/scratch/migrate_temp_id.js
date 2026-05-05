require('dotenv').config({ path: 'backend/.env' });
const { dbManager } = require('../src/config/database');

async function migrateAll() {
    try {
        console.log('--- Starting Migration: Adding temp_id to messages table ---');
        
        // 1. Get all tenants
        const tenantsResult = await dbManager.masterPool.query('SELECT slug, db_url FROM tenants');
        const tenants = tenantsResult.rows;
        
        console.log(`Found ${tenants.length} tenants to migrate.`);
        
        for (const tenant of tenants) {
            console.log(`Migrating tenant: ${tenant.slug}...`);
            try {
                const pool = await dbManager.getPool(tenant.slug, tenant.db_url);
                await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS temp_id TEXT;');
                console.log(`✅ Success for ${tenant.slug}`);
            } catch (err) {
                console.error(`❌ Failed for ${tenant.slug}:`, err.message);
            }
        }
        
        // 2. Also try master database (if it has messages table)
        console.log('Checking master database...');
        try {
            await dbManager.masterPool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS temp_id TEXT;');
            console.log('✅ Success for master database');
        } catch (err) {
            console.log('ℹ️ Master database does not have messages table or already migrated.');
        }
        
        console.log('--- Migration Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateAll();
