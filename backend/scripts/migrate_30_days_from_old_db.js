const { Pool } = require('pg');

const oldDbPool = new Pool({
    connectionString: 'postgresql://postgres:root@localhost:5432/chatbot_db',
});

const newDbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/producto_clientes_finales_db?sslmode=require';
const newDbPool = new Pool({
    connectionString: newDbUrl,
    ssl: { rejectUnauthorized: false }
});

// 30 days ago
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

async function migrateData() {
    console.log('🚀 Iniciando migracion de la base de datos local hacia la nueva sede...');
    try {
        const oldClient = await oldDbPool.connect();
        const newClient = await newDbPool.connect();

        // Obtener chats del antiguo bot actualizados en los ultimos 30 dias
        const { rows: conversations } = await oldClient.query(
            `SELECT * FROM conversations WHERE updated_at > $1 OR last_message_timestamp > $1`,
            [thirtyDaysAgo]
        );

        console.log(`✅  Encontradas ${conversations.length} conversaciones en los ultimos 30 dias. Importando...`);

        let msgsMigrados = 0;
        let convsMigradas = 0;

        for (const conv of conversations) {
            // Migrar la conversacion si no existe
            await newClient.query(`
                INSERT INTO conversations (
                    phone, contact_name, profile_pic_url, status, conversation_state, 
                    ai_enabled, agent_id, taken_by_agent_at, unread_count, 
                    last_message_text, last_message_timestamp, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (phone) DO UPDATE SET
                    contact_name = EXCLUDED.contact_name,
                    last_message_text = EXCLUDED.last_message_text,
                    last_message_timestamp = EXCLUDED.last_message_timestamp,
                    updated_at = EXCLUDED.updated_at
            `, [
                conv.phone, conv.contact_name, conv.profile_pic_url, conv.status, conv.conversation_state,
                conv.ai_enabled, conv.agent_id, conv.taken_by_agent_at, conv.unread_count,
                conv.last_message_text, conv.last_message_timestamp, conv.created_at, conv.updated_at
            ]);
            convsMigradas++;

            // Migrar mensajes de esa conversacion en los ultimos 30 dias
            const { rows: messages } = await oldClient.query(
                `SELECT * FROM messages WHERE conversation_phone = $1 AND timestamp > $2`,
                [conv.phone, thirtyDaysAgo]
            );

            for (const msg of messages) {
                // Verificar si existe el mensaje por el ID (evitar dobles envios)
                try {
                    await newClient.query(`
                        INSERT INTO messages (
                            id, whatsapp_id, conversation_phone, sender, sender_type, 
                            text_content, media_url, media_type, status, timestamp, is_internal_note
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        ON CONFLICT (id) DO NOTHING
                    `, [
                        msg.id, msg.whatsapp_id, msg.conversation_phone, msg.sender, msg.sender_type,
                        msg.text_content, msg.media_url, msg.media_type, msg.status, msg.timestamp, msg.is_internal_note
                    ]);
                    msgsMigrados++;
                } catch (e) {
                    // Unique constraint errors, etc check
                    if (!e.message.includes('unique constraint')) {
                        console.error('Error insertando msg', msg.id, e.message);
                    }
                }
            }
        }

        console.log(`✨ Migracion completada! Conversaciones migradas: ${convsMigradas}, Mensajes migrados: ${msgsMigrados}`);
    } catch (e) {
        console.error('❌ Error migrando data:', e.message);
    } finally {
        await oldDbPool.end();
        await newDbPool.end();
    }
}

migrateData();
