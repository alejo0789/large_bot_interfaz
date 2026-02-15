const { pool } = require('./src/config/database');
require('dotenv').config();

async function testDB() {
    try {
        console.log('Testing DB connection...');
        const result = await pool.query('SELECT NOW()');
        console.log('✅ DB Connection successful:', result.rows[0]);

        console.log('Checking agents table...');
        const agents = await pool.query('SELECT id, username, name, is_active FROM agents LIMIT 5');
        console.log('✅ Agents found:', agents.rows);
    } catch (error) {
        console.error('❌ DB Test failed:', error);
    } finally {
        await pool.end();
    }
}

testDB();
