const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function analyze() {
    const client = new Client({ connectionString });
    await client.connect();

    // Find the tag id for 'Redes'
    const tagRes = await client.query("SELECT id FROM tags WHERE name = 'Redes'");
    if (tagRes.rows.length === 0) {
        console.log("No 'Redes' tag found.");
        await client.end();
        return;
    }
    const redesTagId = tagRes.rows[0].id;
    console.log(`'Redes' tag ID is ${redesTagId}`);

    // Fetch all conversations that have 'Redes' assigned
    const res = await client.query(`
        SELECT ct.conversation_phone, ct.assigned_at, ct.assigned_by,
               ARRAY_AGG(t.name) as all_tags
        FROM conversation_tags ct
        JOIN tags t ON ct.tag_id = t.id
        WHERE ct.conversation_phone IN (
            SELECT conversation_phone FROM conversation_tags WHERE tag_id = $1
        )
        GROUP BY ct.conversation_phone, ct.assigned_at, ct.assigned_by
        ORDER BY ct.assigned_at DESC
    `, [redesTagId]);

    console.log(`Found ${res.rows.length} records matching.`);
    console.table(res.rows);

    await client.end();
}

analyze().catch(console.error);
