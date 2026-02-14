const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function findPlaceholders() {
    try {
        const { rows } = await pool.query("SELECT phone, contact_name FROM conversations WHERE contact_name LIKE 'Usuario %' OR contact_name = phone LIMIT 50");
        console.log(`Found ${rows.length} placeholders.`);
        console.table(rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

findPlaceholders();
