const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function analyze() {
    const client = new Client({ connectionString });
    await client.connect();

    const res = await client.query(`
        SELECT ct.conversation_phone, 
               t.name as tag_name, 
               ct.assigned_at, 
               ct.assigned_by
        FROM conversation_tags ct
        JOIN tags t ON ct.tag_id = t.id
        WHERE ct.assigned_at >= '2026-06-10T00:00:00.000Z'
        ORDER BY ct.assigned_at DESC
    `);

    console.log(`Found ${res.rows.length} tag assignments made today.`);
    console.table(res.rows);

    await client.end();
}

analyze().catch(console.error);
