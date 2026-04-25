const { Pool } = require('pg');
const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkCaliGroups() {
    const pool = new Pool({
        connectionString: masterUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows: tenantRows } = await pool.query("SELECT db_url FROM tenants WHERE slug = 'cali'");
        if (tenantRows.length === 0) {
            console.log('Tenant Cali not found');
            return;
        }

        const caliDbUrl = tenantRows[0].db_url;
        console.log('Cali DB URL found.');

        const caliPool = new Pool({
            connectionString: caliDbUrl,
            ssl: { rejectUnauthorized: false }
        });

        const { rows: convRows } = await caliPool.query("SELECT phone, contact_name FROM conversations WHERE contact_name ILIKE '%Equipo Cali%' OR phone LIKE '%@g.us'");
        console.log('Found groups/conversations in Cali:', convRows);

        if (convRows.length > 0) {
            const groupJid = convRows[0].phone;
            const { rows: msgRows } = await caliPool.query("SELECT sender, text_content, timestamp FROM messages WHERE conversation_phone = $1 ORDER BY timestamp DESC LIMIT 5", [groupJid]);
            console.log(`Last 5 messages for group ${groupJid}:`, msgRows);
        }

        await caliPool.end();
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkCaliGroups();
