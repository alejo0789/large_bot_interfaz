const { Pool } = require('pg');
const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkRecentCali() {
    const pool = new Pool({
        connectionString: masterUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows: tenantRows } = await pool.query("SELECT db_url FROM tenants WHERE slug = 'cali'");
        const caliDbUrl = tenantRows[0].db_url;

        const caliPool = new Pool({
            connectionString: caliDbUrl,
            ssl: { rejectUnauthorized: false }
        });

        const { rows: msgRows } = await caliPool.query("SELECT sender, timestamp FROM messages ORDER BY timestamp DESC LIMIT 5");
        console.log(`Last 5 messages in Cali:`, msgRows);

        await caliPool.end();
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkRecentCali();
