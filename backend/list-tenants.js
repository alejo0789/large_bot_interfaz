
const { Pool } = require('pg');
require('dotenv').config();

async function listTenants() {
    const pool = new Pool({
        connectionString: process.env.MASTER_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows } = await pool.query('SELECT id, name, slug, evolution_instance FROM tenants');
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

listTenants();
