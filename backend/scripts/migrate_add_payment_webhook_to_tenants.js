const { Client } = require('pg');

const MASTER_DB_URL = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function run() {
    const client = new Client(MASTER_DB_URL);
    try {
        await client.connect();
        
        await client.query(`
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_verify_webhook VARCHAR(255);
        `);
        console.log('✅ payment_verify_webhook column added to tenants table in master DB');
        
        // Let's migrate the bogotapaula one we just set into master db
        const WEBHOOK_URL = 'https://primary-gvtr-production.up.railway.app/webhook/d8f7270e-cb53-429f-8955-a28c9cc34eec';
        await client.query(`UPDATE tenants SET payment_verify_webhook = $1 WHERE slug = 'bogotapaula'`, [WEBHOOK_URL]);

        // Also migrate the cali one if it exists
        const CALI_WEBHOOK_URL = 'https://primary-gvtr-production.up.railway.app/webhook/483c1092-27db-4e32-b28f-cde0a05b42e1';
        await client.query(`UPDATE tenants SET payment_verify_webhook = $1 WHERE slug = 'cali'`, [CALI_WEBHOOK_URL]);
        
        console.log('✅ Updated existing webhooks into master DB');
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();
