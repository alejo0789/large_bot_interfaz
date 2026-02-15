const { pool } = require('./src/config/database');
require('dotenv').config();

async function listAgents() {
    try {
        const { rows } = await pool.query('SELECT id, username, name, is_active FROM agents');
        console.log('Current agents:', JSON.stringify(rows, null, 2));
    } catch (error) {
        console.error('❌ Error listing agents:', error);
    } finally {
        await pool.end();
    }
}

listAgents();
