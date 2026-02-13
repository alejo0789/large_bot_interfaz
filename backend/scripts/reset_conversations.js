const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function resetDb() {
    console.log('🛑 DELETING ALL MESSAGES AND CONVERSATIONS...');

    try {
        await pool.query('DELETE FROM messages');
        console.log('✅ Messages deleted.');

        await pool.query('DELETE FROM conversations');
        console.log('✅ Conversations deleted.');

    } catch (error) {
        console.error('❌ Error resetting DB:', error.message);
    } finally {
        await pool.end();
    }
}

resetDb();
