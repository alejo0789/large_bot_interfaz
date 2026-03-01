
const { Pool } = require('pg');
require('dotenv').config();

async function getTenantDb() {
    const pool = new Pool({
        connectionString: process.env.MASTER_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows } = await pool.query('SELECT db_url FROM tenants WHERE slug = $1', ['alejo-wp2']);
        console.log(rows[0].db_url);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

getTenantDb();
