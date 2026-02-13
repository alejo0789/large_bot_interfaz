const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkNames() {
    try {
        const { rows } = await pool.query("SELECT phone, contact_name FROM conversations WHERE contact_name ILIKE '%large%' AND phone NOT LIKE '%@g.us' LIMIT 20");
        console.log('--- Conversations with \"Large\" in name (Private chats) ---');
        console.table(rows);

        if (rows.length > 0) {
            console.log('\n🔄 Cleaning up names...');
            for (const row of rows) {
                const placeholder = `Usuario ${row.phone.slice(-4)}`;
                await pool.query('UPDATE conversations SET contact_name = $1 WHERE phone = $2', [placeholder, row.phone]);
                console.log(`✅ Updated ${row.phone} to ${placeholder}`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkNames();
