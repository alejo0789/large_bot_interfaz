const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:root@localhost:5432/chatbot_db',
    ssl: false // maybe no SSL needed for localhost
});

async function checkMaster() {
    try {
        const client = await pool.connect();
        const { rows } = await client.query(`SELECT COUNT(*) FROM messages`);
        console.log(`Mensajes en chatbot_db: ${rows[0].count}`);
        
        const res = await client.query(`SELECT COUNT(*) FROM conversations`);
        console.log(`Conversaciones en chatbot_db: ${res.rows[0].count}`);
        
        client.release();
        await pool.end();
    } catch (e) {
        console.error(e.message);
    }
}
checkMaster();
