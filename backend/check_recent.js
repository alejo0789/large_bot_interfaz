const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require' });

async function query() {
    try {
        const res = await pool.query("SELECT * FROM messages WHERE sender = 'user' AND timestamp > NOW() - INTERVAL '2 hours' ORDER BY timestamp DESC LIMIT 20");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

query();
