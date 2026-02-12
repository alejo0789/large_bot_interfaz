require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/config/database');

async function cleanup() {
    try {
        console.log('🧹 Starting Database Cleanup...');

        // Delete conversations that have purely numeric IDs longer than 15 digits (mangled group JIDs)
        const result1 = await pool.query(`
            DELETE FROM conversations 
            WHERE phone ~ '^[0-9]+$' AND length(phone) > 15
        `);
        console.log(`✅ Deleted ${result1.rowCount} mangled long-numeric conversations.`);

        // Delete the specific weird ID 75978642600014
        const result2 = await pool.query(`
            DELETE FROM conversations 
            WHERE phone = '75978642600014'
        `);
        console.log(`✅ Deleted ${result2.rowCount} specific mangled conversation (75978642600014).`);

        // Update names that still have JIDs in them
        const result3 = await pool.query(`
            UPDATE conversations 
            SET contact_name = 'Grupo ' || split_part(phone, '@', 1)
            WHERE contact_name LIKE '%@g.us%'
        `);
        console.log(`✅ Updated ${result3.rowCount} placeholder names.`);

    } catch (e) {
        console.error('❌ Cleanup failed:', e);
    } finally {
        process.exit();
    }
}

cleanup();
