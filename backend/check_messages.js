require('dotenv').config();
const { Pool } = require('pg');

async function checkMessages() {
    const masterPool = new Pool({ connectionString: process.env.MASTER_DATABASE_URL });
    try {
        const { rows: tenants } = await masterPool.query("SELECT id, db_url FROM tenants WHERE slug = 'testoficial'");
        if (tenants.length === 0) {
            console.error("Sede no encontrada");
            return;
        }

        const tenantDbUrl = tenants[0].db_url;
        console.log(`Connecting to tenant DB...`);
        const tenantPool = new Pool({ connectionString: tenantDbUrl });

        const { rows: messages } = await tenantPool.query("SELECT * FROM messages ORDER BY timestamp DESC LIMIT 10");
        console.log("Últimos 10 mensajes en la sede testoficial:");
        messages.forEach(m => {
            console.log(`[${m.timestamp}] ${m.sender}: ${m.text_content?.substring(0, 50)} (WA_ID: ${m.whatsapp_id})`);
        });

        await tenantPool.end();
    } catch (err) {
        console.error(err);
    } finally {
        await masterPool.end();
    }
}

checkMessages();
