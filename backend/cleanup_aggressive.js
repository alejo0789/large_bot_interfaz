const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function cleanup() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("🧹 Iniciando limpieza agresiva de LIDs no resueltos...");

        // 1. Identificar LIDs que no pudimos normalizar a Colombia
        const { rows: lids } = await pool.query(`
            SELECT phone FROM conversations 
            WHERE length(phone) > 13 
            AND phone NOT LIKE '+57%'
        `);

        console.log(`Encontrados ${lids.length} LIDs sospechosos.`);

        for (const lid of lids) {
            // Verificar si tiene mensajes del USUARIO
            const { rowCount } = await pool.query(`
                SELECT 1 FROM messages 
                WHERE conversation_phone = $1 
                AND sender = 'user'
            `, [lid.phone]);

            if (rowCount === 0) {
                console.log(`   🗑️ Borrando LID sin mensajes de usuario: ${lid.phone}`);
                await pool.query("DELETE FROM messages WHERE conversation_phone = $1", [lid.phone]);
                await pool.query("DELETE FROM conversations WHERE phone = $1", [lid.phone]);
            } else {
                console.log(`   ⚠️ LID tiene mensajes de usuario, se mantiene por ahora: ${lid.phone}`);
            }
        }

        console.log("\n✨ Limpieza terminada.");
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

cleanup();
