const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function check() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("🔍 Buscando números específicos...");
        const { rows } = await pool.query("SELECT phone, contact_name, last_message_text FROM conversations WHERE phone LIKE '%16308594864222%' OR phone LIKE '%3003073365%'");
        console.table(rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
