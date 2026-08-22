const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require',
});

async function main() {
    try {
        const { rows } = await pool.query('SELECT id, name, slug, whatsapp_provider, waba_id, phone_number_id FROM tenants');
        console.log('📋 Tenants in DB:');
        console.table(rows);
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

main();
