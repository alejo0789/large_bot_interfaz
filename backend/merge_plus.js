const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

async function mergePlusConversations() {
    console.log("🔍 Buscando conversaciones con signo '+'...");
    
    try {
        const res = await pool.query("SELECT * FROM conversations WHERE phone LIKE '+%'");
        const withPlus = res.rows;
        
        console.log(`📋 Encontradas ${withPlus.length} conversaciones con prefijo '+'`);
        
        for (const conv of withPlus) {
            const phoneWithPlus = conv.phone;
            const phonePure = phoneWithPlus.startsWith('+') ? phoneWithPlus.slice(1) : phoneWithPlus;
            
            console.log(`\n⏳ Procesando ${phoneWithPlus} -> ${phonePure}`);
            
            // Check if the pure phone already exists
            const check = await pool.query('SELECT * FROM conversations WHERE phone = $1', [phonePure]);
            
            if (check.rows.length > 0) {
                console.log(`   🔸 La versión sin '+' YA existe. Moviendo mensajes y etiquetas...`);
                const pureConv = check.rows[0];
                
                // Mover mensajes
                await pool.query('UPDATE messages SET conversation_phone = $1 WHERE conversation_phone = $2', [phonePure, phoneWithPlus]);
                
                // Mover etiquetas
                await pool.query(`
                    UPDATE conversation_tags 
                    SET conversation_phone = $1 
                    WHERE conversation_phone = $2 
                    AND NOT EXISTS (
                        SELECT 1 FROM conversation_tags ct2 
                        WHERE ct2.conversation_phone = $1 AND ct2.tag_id = conversation_tags.tag_id
                    )
                `, [phonePure, phoneWithPlus]);
                
                await pool.query('DELETE FROM conversation_tags WHERE conversation_phone = $1', [phoneWithPlus]);
                
                // Actualizar timestamp si el del '+' es más reciente
                if (conv.last_message_timestamp && (!pureConv.last_message_timestamp || conv.last_message_timestamp > pureConv.last_message_timestamp)) {
                     await pool.query(`
                        UPDATE conversations 
                        SET last_message_text = $1, last_message_timestamp = $2 
                        WHERE phone = $3
                     `, [conv.last_message_text, conv.last_message_timestamp, phonePure]);
                }
                
                // Eliminar la copia con '+'
                await pool.query('DELETE FROM conversations WHERE phone = $1', [phoneWithPlus]);
                console.log(`   ✅ Fusionada correctamente.`);
            } else {
                console.log(`   🔹 La versión sin '+' NO existe. Renombrando la conversación principal...`);
                // Mueve todo indirectamente
                // However, there is a constraint on table. 
                // In Postgres you can just UPDATE the primary key if using CASCADE, but let's do safe insert
                
                await pool.query(`
                        INSERT INTO conversations 
                        (phone, contact_name, ai_enabled, status, lead_intent, last_message_text, last_message_timestamp, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                `, [phonePure, conv.contact_name, conv.ai_enabled, conv.status, conv.lead_intent, conv.last_message_text, conv.last_message_timestamp]);
                
                await pool.query('UPDATE messages SET conversation_phone = $1 WHERE conversation_phone = $2', [phonePure, phoneWithPlus]);
                await pool.query('UPDATE conversation_tags SET conversation_phone = $1 WHERE conversation_phone = $2', [phonePure, phoneWithPlus]);
                await pool.query('DELETE FROM conversations WHERE phone = $1', [phoneWithPlus]);
                
                console.log(`   ✅ Renombrada correctamente a ${phonePure}.`);
            }
        }
        
        console.log(`\n🎉 Limpieza de '+' finalizada!`);
    } catch (e) {
        console.error("Error global:", e);
    } finally {
        pool.end();
    }
}

mergePlusConversations();
