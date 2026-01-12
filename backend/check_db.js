const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkData() {
    try {
        const client = await pool.connect();

        console.log('--- AGENTS ---');
        const agents = await client.query('SELECT id, username, name FROM agents');
        console.table(agents.rows);

        console.log('\n--- LAST 5 MESSAGES ---');
        const messages = await client.query('SELECT id, sender, text_content, agent_id, agent_name, timestamp FROM messages ORDER BY timestamp DESC LIMIT 5');
        console.table(messages.rows);

        client.release();
        pool.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkData();
