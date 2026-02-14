const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function findCanela() {
    try {
        const { rows } = await pool.query("SELECT phone, contact_name FROM conversations WHERE contact_name ILIKE '%Canela%'");
        console.table(rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

findCanela();
