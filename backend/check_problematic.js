const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function check() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("🔍 Buscando los números reportados...");
        const { rows } = await pool.query(`
            SELECT phone, contact_name, last_message_text 
            FROM conversations 
            WHERE phone LIKE '%14568881397895%' 
            OR phone LIKE '%26092043796715%'
        `);
        console.table(rows);

        if (rows.length > 0) {
            for (const row of rows) {
                console.log(`\n📩 Mensajes para ${row.phone}:`);
                const { rows: msgs } = await pool.query(`
                    SELECT text_content, sender, timestamp, sender_name 
                    FROM messages 
                    WHERE conversation_phone = $1 
                    ORDER BY timestamp DESC LIMIT 5
                `, [row.phone]);
                console.table(msgs);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
