const { Pool } = require('pg');
const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkAllTenantsGroups() {
    const pool = new Pool({
        connectionString: masterUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows: ts } = await pool.query('SELECT slug, db_url FROM tenants');
        for (const t of ts) {
            try {
                const cp = new Pool({
                    connectionString: t.db_url,
                    ssl: { rejectUnauthorized: false }
                });
                const { rows: m } = await cp.query("SELECT COUNT(id) FROM messages WHERE conversation_phone LIKE '%@g.us' AND timestamp > '2026-04-20'");
                if (parseInt(m[0].count) > 0) {
                    console.log(`Tenant ${t.slug} has ${m[0].count} group messages since April 20`);
                }
                await cp.end();
            } catch (e) {
                console.error(`Error checking tenant ${t.slug}:`, e.message);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkAllTenantsGroups();
