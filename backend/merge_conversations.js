const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

// Simplified normalization logic for this script
function getStandardPhone(phone) {
    if (!phone) return null;
    let digits = String(phone).replace(/\D/g, '');

    // Colombian mobile search (specifically 30, 31, 32, 35 prefixes)
    const colMatch = digits.match(/(30|31|32|35)\d{8}/);
    if (colMatch) {
        return '+57' + colMatch[0];
    }

    return null;
}

async function mergeConversations() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("🚀 Iniciando fusión de conversaciones (LIDs -> +57)...");

        // 1. Obtener todas las conversaciones
        const { rows: allConvs } = await pool.query("SELECT phone, contact_name FROM conversations");
        console.log(`📊 Analizando ${allConvs.length} conversaciones...`);

        const map = new Map(); // targetPhone -> [sourcePhones]

        for (const conv of allConvs) {
            const standard = getStandardPhone(conv.phone);
            if (standard && standard !== conv.phone) {
                if (!map.has(standard)) map.set(standard, []);
                map.get(standard).push(conv.phone);
            }
        }

        console.log(`🧩 Se encontraron ${map.size} números con posibles duplicados.`);

        for (const [target, sources] of map.entries()) {
            console.log(`\n🔄 Procesando destino: ${target}`);

            // Asegurar que la conversación destino exista
            const { rowCount } = await pool.query("SELECT 1 FROM conversations WHERE phone = $1", [target]);
            if (rowCount === 0) {
                console.log(`   🏗️ Creando conversación destino: ${target}...`);
                // Intentar obtener el nombre de uno de los orígenes
                const sourceData = allConvs.find(c => sources.includes(c.phone));
                await pool.query(
                    "INSERT INTO conversations (phone, contact_name, status, created_at, updated_at, ai_enabled, conversation_state) VALUES ($1, $2, 'active', NOW(), NOW(), false, 'agent_active')",
                    [target, sourceData ? sourceData.contact_name : target]
                );
            }

            for (const source of sources) {
                console.log(`   🖇️ Fusionando: ${source} -> ${target}`);

                // Mover mensajes
                const resMsgs = await pool.query(
                    "UPDATE messages SET conversation_phone = $1 WHERE conversation_phone = $2",
                    [target, source]
                );
                console.log(`      ✅ ${resMsgs.rowCount} mensajes movidos.`);

                // Mover tags
                try {
                    await pool.query(
                        "UPDATE conversation_tags SET conversation_phone = $1 WHERE conversation_phone = $2",
                        [target, source]
                    );
                } catch (tagErr) {
                    console.log(`      ℹ️ Conflicto en tags ignorado.`);
                }

                // Borrar origen
                await pool.query("DELETE FROM conversation_tags WHERE conversation_phone = $1", [source]);
                await pool.query("DELETE FROM conversations WHERE phone = $1", [source]);
                console.log(`      🗑️ Origen eliminado.`);
            }

            // Actualizar último mensaje del destino
            await pool.query(`
                UPDATE conversations 
                SET 
                    last_message_text = (SELECT text_content FROM messages WHERE conversation_phone = $1 ORDER BY timestamp DESC LIMIT 1),
                    last_message_timestamp = (SELECT timestamp FROM messages WHERE conversation_phone = $1 ORDER BY timestamp DESC LIMIT 1)
                WHERE phone = $1
            `, [target]);
        }

        console.log("\n✨ Fusión terminada con éxito.");
    } catch (err) {
        console.error("❌ Error en merge:", err);
    } finally {
        await pool.end();
    }
}

mergeConversations();
