require('dotenv').config();
const { dbManager } = require('../src/config/database');

async function migrate() {
    try {
        console.log('Migrating database to add Official WhatsApp API fields...');

        // Ensure master pool is connected
        if (!dbManager.masterPool) {
            await dbManager.connectMaster();
        }

        const client = await dbManager.masterPool.connect();

        try {
            await client.query('BEGIN');

            // Add whatsapp_provider
            await client.query(`
                ALTER TABLE tenants 
                ADD COLUMN IF NOT EXISTS whatsapp_provider VARCHAR(50) DEFAULT 'evolution'
            `);

            // Add official API credentials
            await client.query(`
                ALTER TABLE tenants 
                ADD COLUMN IF NOT EXISTS wa_phone_number_id VARCHAR(255),
                ADD COLUMN IF NOT EXISTS wa_access_token TEXT,
                ADD COLUMN IF NOT EXISTS wa_verify_token VARCHAR(255)
            `);

            await client.query('COMMIT');
            console.log('✅ Migration successful: Added whatsapp_provider, wa_phone_number_id, wa_access_token, wa_verify_token to tenants table.');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
