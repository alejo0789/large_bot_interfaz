/**
 * Script rápido para verificar cuántos mensajes hay en la DB
 */
require('dotenv').config();
const { pool } = require('../src/config/database');

async function checkMessages() {
    try {
        const { rows } = await pool.query(`
            SELECT 
                COUNT(*) as total_messages,
                COUNT(DISTINCT phone) as conversations_with_messages,
                MIN(timestamp) as oldest_message,
                MAX(timestamp) as newest_message
            FROM messages
        `);

        console.log('\n📊 Database Statistics:');
        console.log('=======================');
        console.log(`Total messages: ${rows[0].total_messages}`);
        console.log(`Conversations with messages: ${rows[0].conversations_with_messages}`);
        console.log(`Oldest message: ${rows[0].oldest_message || 'N/A'}`);
        console.log(`Newest message: ${rows[0].newest_message || 'N/A'}`);
        console.log('=======================\n');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkMessages();
