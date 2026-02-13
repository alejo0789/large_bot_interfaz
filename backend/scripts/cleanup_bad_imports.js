const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function cleanup() {
    try {
        console.log('🧹 Cleaning up bad imports...');

        // Delete messages linked to bad conversations first (FK constraint)
        const deleteMessages = await pool.query(`
            DELETE FROM messages 
            WHERE conversation_phone ~ '^[a-z]' 
               OR conversation_phone LIKE 'cmljz%'
        `);
        console.log(`🗑️  Deleted ${deleteMessages.rowCount} bad messages.`);

        // Delete bad conversations
        // Identificar por patrón: empiezan con letras minúsculas (ids de cuid) en lugar de números
        const deleteConversations = await pool.query(`
            DELETE FROM conversations 
            WHERE phone ~ '^[a-z]' 
               OR phone LIKE 'cmljz%'
        `);
        console.log(`🗑️  Deleted ${deleteConversations.rowCount} bad conversations.`);

    } catch (error) {
        console.error('❌ Error cleaning up:', error);
    } finally {
        await pool.end();
    }
}

cleanup();
