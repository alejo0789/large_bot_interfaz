const { Pool } = require('pg');
require('dotenv').config();

const masterPool = new Pool({
    connectionString: process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkTenants() {
    try {
        const { rows } = await masterPool.query('SELECT * FROM tenants');
        console.table(rows.map(r => ({ id: r.id, slug: r.slug, name: r.name, db_url: r.db_url.substring(0, 50) + "..." })));
    } catch (err) {
        console.error('Error checking tenants:', err);
    } finally {
        await masterPool.end();
    }
}

checkTenants();
