const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/pereira_db?sslmode=require&channel_binding=require';

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function fixLastMessage() {
    const client = await pool.connect();
    try {
        console.log('🔄 Actualizando últimos mensajes en la tabla de conversaciones...');
        
        const query = `
            UPDATE conversations c
            SET 
                last_message_text = COALESCE(m.text_content, 'Archivo multimedia'),
                last_message_timestamp = m.timestamp
            FROM (
                SELECT DISTINCT ON (conversation_phone) conversation_phone, text_content, timestamp, media_url
                FROM messages
                ORDER BY conversation_phone, timestamp DESC
            ) m
            WHERE c.phone = m.conversation_phone
            AND (c.last_message_text IS NULL OR c.last_message_text = '');
        `;
        
        const res = await client.query(query);
        console.log(`✅ Se han actualizado ${res.rowCount} conversaciones con su último mensaje real.`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

fixLastMessage();
