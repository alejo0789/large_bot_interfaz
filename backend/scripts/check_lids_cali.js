const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const res = await pool.query(`
            SELECT phone, contact_name, last_message_text, last_message_timestamp
            FROM conversations
            WHERE phone LIKE '%@lid' OR (LENGTH(phone) >= 14 AND phone NOT LIKE '%@g.us' AND phone NOT LIKE '%@broadcast')
        `);
        console.log(`Found ${res.rows.length} matches:`);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
check();
