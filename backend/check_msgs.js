const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function check() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("📩 Mensajes de +16308594864222:");
        const res1 = await pool.query("SELECT text_content, sender, timestamp FROM messages WHERE conversation_phone = '+16308594864222' ORDER BY timestamp DESC LIMIT 5");
        console.table(res1.rows);

        console.log("\n📩 Mensajes de +573003073365:");
        const res2 = await pool.query("SELECT text_content, sender, timestamp FROM messages WHERE conversation_phone = '+573003073365' ORDER BY timestamp DESC LIMIT 5");
        console.table(res2.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
