const { Pool } = require('pg');
const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkGroupCaliRecent() {
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

        const { rows: countRows } = await caliPool.query("SELECT COUNT(id) FROM messages WHERE conversation_phone LIKE '%@g.us' AND timestamp > '2026-04-20'");
        console.log('Group messages in Cali since April 20:', countRows[0].count);

        if (countRows[0].count > 0) {
            const { rows: sample } = await caliPool.query("SELECT conversation_phone, text_content, timestamp FROM messages WHERE conversation_phone LIKE '%@g.us' AND timestamp > '2026-04-20' ORDER BY timestamp DESC LIMIT 5");
            console.log('Sample group messages:', sample);
        }

        await caliPool.end();
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkGroupCaliRecent();
