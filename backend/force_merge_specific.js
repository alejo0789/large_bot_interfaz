const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function forceMerge(source, target) {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log(`🚀 Fusionando manualmente ${source} -> ${target}...`);

        // 1. Mover mensajes
        const resMsgs = await pool.query(
            "UPDATE messages SET conversation_phone = $1 WHERE conversation_phone = $2",
            [target, source]
        );
        console.log(`   ✅ ${resMsgs.rowCount} mensajes movidos.`);

        // 2. Mover tags
        await pool.query(
            "UPDATE conversation_tags SET conversation_phone = $1 WHERE conversation_phone = $2",
            [target, source]
        ).catch(() => console.log("   ℹ️ Conflicto en tags ignorado."));

        // 3. Borrar origen
        await pool.query("DELETE FROM conversation_tags WHERE conversation_phone = $1", [source]);
        await pool.query("DELETE FROM conversations WHERE phone = $1", [source]);
        console.log(`   🗑️ Origen ${source} eliminado.`);

        // 4. Actualizar último mensaje
        await pool.query(`
            UPDATE conversations 
            SET 
                last_message_text = (SELECT text_content FROM messages WHERE conversation_phone = $1 ORDER BY timestamp DESC LIMIT 1),
                last_message_timestamp = (SELECT timestamp FROM messages WHERE conversation_phone = $1 ORDER BY timestamp DESC LIMIT 1)
            WHERE phone = $1
        `, [target]);

        console.log(`✨ Fusión completada para ${target}.`);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

// Escenario: El usuario dice que 16308594864222 es CALL CENTER (+573009683375)
forceMerge('+16308594864222', '+573009683375');
