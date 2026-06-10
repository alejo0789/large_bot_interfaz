const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        // Query LIDs with messages
        const { rows: withMsgs } = await pool.query(`
            SELECT c.phone, COUNT(m.id) as msg_count
            FROM conversations c
            JOIN messages m ON c.phone = m.conversation_phone
            WHERE c.phone LIKE '%@lid' OR (LENGTH(c.phone) >= 14 AND c.phone NOT LIKE '%@g.us' AND c.phone NOT LIKE '%@broadcast')
            GROUP BY c.phone
        `);
        
        // Query LIDs with tags
        const { rows: withTags } = await pool.query(`
            SELECT c.phone, COUNT(t.tag_id) as tag_count
            FROM conversations c
            JOIN conversation_tags t ON c.phone = t.conversation_phone
            WHERE c.phone LIKE '%@lid' OR (LENGTH(c.phone) >= 14 AND c.phone NOT LIKE '%@g.us' AND c.phone NOT LIKE '%@broadcast')
            GROUP BY c.phone
        `);

        console.log(`LID conversations with messages: ${withMsgs.length}`);
        console.log(`LID conversations with tags: ${withTags.length}`);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
check();
