const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function scan() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("🔍 Escaneando LIDs con mensajes de usuario...");
        const { rows: lids } = await pool.query(`
            SELECT DISTINCT conversation_phone 
            FROM messages 
            WHERE length(conversation_phone) > 13 
            AND sender = 'user'
        `);

        console.log(`Encontrados ${lids.length} LIDs con actividad de usuario.`);

        for (const lid of lids) {
            const { rows: msgs } = await pool.query(`
                SELECT text_content FROM messages 
                WHERE conversation_phone = $1 AND sender = 'user' 
                ORDER BY timestamp DESC LIMIT 3
            `, [lid.conversation_phone]);

            console.log(`\nLID: ${lid.conversation_phone}`);
            msgs.forEach(m => console.log(`   > ${m.text_content.substring(0, 100).replace(/\n/g, ' ')}`));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
scan();
