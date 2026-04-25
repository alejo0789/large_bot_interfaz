const { Pool } = require('pg');
const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkCaliTenant() {
    const pool = new Pool({
        connectionString: masterUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows } = await pool.query("SELECT id, name, slug, evolution_instance, is_active FROM tenants WHERE slug = 'cali'");
        console.log('Cali Tenant Record:', rows[0]);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkCaliTenant();
