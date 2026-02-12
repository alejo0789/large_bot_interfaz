const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require' });

async function query() {
    try {
        const res = await pool.query(`
            SELECT * FROM messages 
            WHERE conversation_phone LIKE '%75978642600014%' 
            ORDER BY timestamp DESC 
            LIMIT 5
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

query();
