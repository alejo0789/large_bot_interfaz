const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function investigate() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("🔍 Investigando duplicados...");

        // Buscamos números que compartan el inicio
        const { rows } = await pool.query(`
            SELECT phone, contact_name, last_message_text 
            FROM conversations 
            WHERE phone LIKE '+3015518355%' 
            OR phone LIKE '+573015518355%'
        `);
        console.log("Resultados para 3015518355:");
        console.table(rows);

        const { rows: allLong } = await pool.query(`
            SELECT phone, contact_name, last_message_text 
            FROM conversations 
            WHERE length(phone) > 13
            LIMIT 20
        `);
        console.log("\nEjemplos de números largos (>13 dígitos):");
        console.table(allLong);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
investigate();
