const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function wipe() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("💣 INICIANDO BORRADO TOTAL DE DATOS PARA RE-SINCRONIZACIÓN...");

        await pool.query("BEGIN");

        await pool.query("DELETE FROM messages");
        await pool.query("DELETE FROM conversation_tags");
        await pool.query("DELETE FROM conversations");

        await pool.query("COMMIT");

        console.log("✅ Base de datos limpia (conversations, messages, tags).");
    } catch (e) {
        await pool.query("ROLLBACK");
        console.error("❌ Error al limpiar:", e);
    } finally {
        await pool.end();
    }
}
wipe();
