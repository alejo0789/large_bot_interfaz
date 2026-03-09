const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function cleanupLids() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("🔍 Buscando posibles duplicados por LID (números extraños)...");

        // Buscamos números que tengan más de 15 dígitos o empiecen por +84... (que no es Colombia +57)
        // El usuario reportó +84770037960872
        const { rows } = await pool.query(`
            SELECT phone, contact_name, last_message_text 
            FROM conversations 
            WHERE (length(phone) > 15 OR phone LIKE '+84%')
            AND phone NOT LIKE '+57%'
        `);

        if (rows.length === 0) {
            console.log("✅ No se encontraron más duplicados evidentes.");
            return;
        }

        console.log(`\n⚠️ Se encontraron ${rows.length} conversaciones sospechosas:`);
        console.table(rows);

        console.log("\n🚀 Eliminando duplicados LID para limpiar la lista...");
        for (const row of rows) {
            // Primero borrar mensajes para evitar errores de integridad si no hay cascade
            await pool.query("DELETE FROM messages WHERE conversation_phone = $1", [row.phone]);
            await pool.query("DELETE FROM conversation_tags WHERE conversation_phone = $1", [row.phone]);
            await pool.query("DELETE FROM conversations WHERE phone = $1", [row.phone]);
            console.log(`   🗑️ Borrado: ${row.phone} (${row.contact_name})`);
        }

        console.log("\n✨ Limpieza terminada. Los mensajes reales residirán en el número correcto (+57...).");
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

cleanupLids();
