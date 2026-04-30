const { Pool } = require('pg');

const MEDELLIN_DB_URL = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/medellin2?sslmode=require&channel_binding=require';

async function checkConversations() {
    const pool = new Pool({
        connectionString: MEDELLIN_DB_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows: convs } = await pool.query('SELECT phone, contact_name, last_message_timestamp FROM conversations');
        console.log(`Total conversations: ${convs.length}`);
        console.table(convs);

        const { rows: msgs } = await pool.query('SELECT COUNT(*) as total FROM messages');
        console.log(`Total messages: ${msgs[0].total}`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkConversations();
