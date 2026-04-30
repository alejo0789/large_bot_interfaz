const { Pool } = require('pg');
require('dotenv').config();

const masterPool = new Pool({
    connectionString: process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkMedellin2Details() {
    try {
        const { rows } = await masterPool.query("SELECT slug, evolution_instance, is_active FROM tenants WHERE slug = 'medellin2'");
        console.table(rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await masterPool.end();
    }
}

checkMedellin2Details();
