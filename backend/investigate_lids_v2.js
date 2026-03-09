const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function investigate() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("🔍 Investigando ejemplos de LIDs reportados...");
        const { rows } = await pool.query(`
            SELECT phone, contact_name, last_message_text 
            FROM conversations 
            WHERE phone LIKE '%56036438372368%' 
            OR phone LIKE '%14306653515995%'
        `);
        console.table(rows);

        console.log("\n🔍 Buscando patrones en los números largos...");
        const { rows: patternRows } = await pool.query(`
            SELECT phone, contact_name, last_message_text 
            FROM conversations 
            WHERE length(phone) > 13
            LIMIT 10
        `);
        console.table(patternRows);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
investigate();
