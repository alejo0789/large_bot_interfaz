const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function inspectTags() {
    const client = new Client({ connectionString });
    await client.connect();
    
    // 1. Get all tags
    const tagsRes = await client.query('SELECT * FROM tags ORDER BY id DESC LIMIT 50');
    console.log("=== LAST 50 TAGS ===");
    console.table(tagsRes.rows);

    // 2. Get tags assigned to conversations with count
    const assignmentsRes = await client.query(`
        SELECT t.id, t.name, COUNT(ct.conversation_phone) as count
        FROM tags t
        LEFT JOIN conversation_tags ct ON t.id = ct.tag_id
        GROUP BY t.id, t.name
        ORDER BY count DESC
    `);
    console.log("=== CHATS PER TAG ===");
    console.table(assignmentsRes.rows);

    // 3. Get recent assignments details
    const recentRes = await client.query(`
        SELECT ct.conversation_phone, t.name as tag_name, ct.assigned_at, ct.assigned_by
        FROM conversation_tags ct
        JOIN tags t ON ct.tag_id = t.id
        ORDER BY ct.assigned_at DESC
        LIMIT 30
    `);
    console.log("=== RECENT ASSIGNMENTS ===");
    console.table(recentRes.rows);

    await client.end();
}

inspectTags().catch(console.error);
