const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSpecificNumbers() {
    const numbers = ['+573023583829', '+573003727428', '+573016032268'];
    try {
        console.log('--- Checking Specific Numbers ---');
        for (const num of numbers) {
            const { rows } = await pool.query('SELECT phone, contact_name, unread_count FROM conversations WHERE phone = $1', [num]);
            console.log(rows[0] || `❌ ${num} not found`);
        }

        console.log('\n--- Resetting Large Cali and Unread Counts ---');
        const { rowCount } = await pool.query(`
            UPDATE conversations 
            SET contact_name = 'Usuario ' || RIGHT(phone, 4), unread_count = 0
            WHERE (contact_name ILIKE '%large%' OR phone IN ($1, $2, $3))
            AND phone NOT LIKE '%@g.us'
        `, numbers);

        console.log(`✅ Fixed ${rowCount} conversations.`);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkSpecificNumbers();
