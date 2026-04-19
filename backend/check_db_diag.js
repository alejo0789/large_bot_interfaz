require('dotenv').config();
const { pool } = require('./src/config/database');

async function checkColumns() {
    try {
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'messages' 
            AND column_name LIKE 'reply_to%';
        `);
        console.log('Columns found:', res.rows);
        
        // Also check if there are any messages with replyTo data
        const res2 = await pool.query(`
            SELECT id, text_content, reply_to_id, reply_to_text
            FROM messages
            WHERE reply_to_id IS NOT NULL 
            LIMIT 5;
        `);
        console.log('Messages with replyTo:', res2.rows);
        
    } catch (err) {
        console.error('Error checking columns:', err.message);
    } finally {
        process.exit();
    }
}

checkColumns();
