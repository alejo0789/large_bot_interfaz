const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function check() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        const lids = ['+14568881397895', '+26092043796715'];
        for (const lid of lids) {
            console.log(`\n🔍 Mensajes para ${lid}:`);
            const { rows } = await pool.query(`
                SELECT text_content, sender FROM messages 
                WHERE conversation_phone = $1 
                AND text_content ~ '3[0-9]{9}'
                LIMIT 5
            `, [lid]);
            console.table(rows);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
