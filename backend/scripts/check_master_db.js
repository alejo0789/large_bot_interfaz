const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:root@localhost:5432/chatbot_master',
    ssl: false // maybe no SSL needed for localhost
});

async function checkMaster() {
    try {
        const client = await pool.connect();
        const { rows } = await client.query(`SELECT COUNT(*) FROM messages WHERE timestamp > NOW() - INTERVAL '30 days'`);
        console.log(`Mensajes recientes en Master: ${rows[0].count}`);
        
        const res = await client.query(`SELECT COUNT(*) FROM conversations`);
        console.log(`Conversaciones en Master: ${res.rows[0].count}`);
        
        client.release();
        await pool.end();
    } catch (e) {
        console.error(e.message);
    }
}
checkMaster();
