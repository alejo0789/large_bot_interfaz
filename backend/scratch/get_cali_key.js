const { Pool } = require('pg');
const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function getCaliKey() {
    const pool = new Pool({
        connectionString: masterUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows } = await pool.query("SELECT evolution_instance, evolution_api_key FROM tenants WHERE slug = 'cali'");
        console.log('Cali Evolution Info:', rows[0]);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

getCaliKey();
