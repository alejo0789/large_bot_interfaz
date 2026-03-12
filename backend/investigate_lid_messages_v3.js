const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function check() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        const lid = '+110664244809851';
        console.log(`🔍 Mensajes de usuario en el LID ${lid}:`);
        const { rows } = await pool.query(`
            SELECT text_content, sender, timestamp 
            FROM messages 
            WHERE conversation_phone = $1 
            ORDER BY timestamp ASC
        `, [lid]);
        console.table(rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
