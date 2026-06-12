const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function analyze() {
    const client = new Client({ connectionString });
    await client.connect();

    const res = await client.query(`
        SELECT id, conversation_phone, sender, text_content, whatsapp_id, timestamp
        FROM messages
        WHERE conversation_phone IN (
            SELECT conversation_phone 
            FROM conversation_tags 
            WHERE assigned_at >= '2026-06-10T00:00:00.000Z'
        )
        LIMIT 20
    `);

    console.table(res.rows);
    await client.end();
}

analyze().catch(console.error);
