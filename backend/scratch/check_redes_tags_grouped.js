const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function analyze() {
    const client = new Client({ connectionString });
    await client.connect();

    const res = await client.query(`
        SELECT ct.conversation_phone, 
               ARRAY_AGG(t.name || ' (by ' || COALESCE(ct.assigned_by, 'null') || ' at ' || ct.assigned_at::text || ')') as tag_details
        FROM conversation_tags ct
        JOIN tags t ON ct.tag_id = t.id
        WHERE ct.conversation_phone IN (
            SELECT conversation_phone FROM conversation_tags WHERE tag_id = 542
        )
        GROUP BY ct.conversation_phone
        ORDER BY ct.conversation_phone
    `);

    console.log(`Found ${res.rows.length} conversations with 'Redes' tag.`);
    for (const row of res.rows) {
        if (row.tag_details.length > 1) {
            console.log(`Phone: ${row.conversation_phone}`);
            console.log(`Tags:`, row.tag_details);
            console.log('---');
        }
    }

    await client.end();
}

analyze().catch(console.error);
