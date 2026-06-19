/**
 * Script: Set payment verification webhook for Cali (chatbot_db)
 * Run: node scripts/set_cali_payment_webhook.js
 */
const { Client } = require('pg');

const CALI_DB_URL = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require';
const WEBHOOK_URL = 'https://primary-gvtr-production.up.railway.app/webhook/483c1092-27db-4e32-b28f-cde0a05b42e1';

async function run() {
    const client = new Client(CALI_DB_URL);
    try {
        await client.connect();
        console.log('✅ Conectado a chatbot_db (Cali)');

        // Insert key/value into settings
        // Since it is JSONB, we serialize the string URL to a JSON string representation
        await client.query(
            `INSERT INTO settings (key, value)
             VALUES ($1, $2::jsonb)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            ['payment_verify_webhook', JSON.stringify(WEBHOOK_URL)]
        );

        console.log('✅ Webhook de verificación de pagos guardado en Cali.');

        // Verify the setting
        const { rows } = await client.query('SELECT key, value FROM settings WHERE key = $1', ['payment_verify_webhook']);
        console.log('📋 Configuración actual:', rows[0]);

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
