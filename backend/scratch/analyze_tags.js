const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function analyze() {
    const client = new Client({ connectionString });
    await client.connect();

    const res = await client.query(`
        SELECT ct.conversation_phone, t.name as tag_name, ct.assigned_at, ct.assigned_by
        FROM conversation_tags ct
        JOIN tags t ON ct.tag_id = t.id
        WHERE t.name = 'Redes'
        ORDER BY ct.assigned_at DESC
    `);

    console.log(`=== ALL ASSIGNMENTS OF 'Redes': ${res.rows.length} ===`);
    console.table(res.rows);

    await client.end();
}

analyze().catch(console.error);
