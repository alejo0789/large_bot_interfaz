const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function check() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("📋 Listado de las últimas 20 conversaciones:");
        const { rows } = await pool.query(`
            SELECT phone, contact_name, last_message_text 
            FROM conversations 
            ORDER BY updated_at DESC 
            LIMIT 20
        `);
        console.table(rows);

        console.log("\n📋 Listado de conversaciones que todavía tienen más de 13 caracteres (LIDs no resueltos):");
        const { rows: lids } = await pool.query(`
            SELECT phone, contact_name 
            FROM conversations 
            WHERE length(phone) > 13
            LIMIT 20
        `);
        console.table(lids);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
