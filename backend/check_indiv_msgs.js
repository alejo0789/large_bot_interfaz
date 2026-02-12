const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require' });

async function query() {
    try {
        const res = await pool.query(`
            SELECT conversation_phone, text_content, whatsapp_id, timestamp 
            FROM messages 
            WHERE sender = 'user' 
            AND conversation_phone NOT LIKE '%@g.us%' 
            ORDER BY timestamp DESC 
            LIMIT 10
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

query();
