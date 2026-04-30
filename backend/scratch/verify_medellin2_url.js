const { Pool } = require('pg');
require('dotenv').config();

const masterPool = new Pool({
    connectionString: process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkMedellin2() {
    try {
        const { rows } = await masterPool.query("SELECT slug, db_url FROM tenants WHERE slug = 'medellin2'");
        if (rows.length > 0) {
            console.log(`Tenant: ${rows[0].slug}`);
            console.log(`DB URL in Master: ${rows[0].db_url}`);
        } else {
            console.log("Tenant medellin2 not found in Master DB");
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await masterPool.end();
    }
}

checkMedellin2();
