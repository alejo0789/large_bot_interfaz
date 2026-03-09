require('dotenv').config();
const { Pool } = require('pg');

async function findTenant() {
    const pool = new Pool({ connectionString: process.env.MASTER_DATABASE_URL });
    try {
        const res = await pool.query("SELECT id, slug, db_url, evolution_instance FROM tenants WHERE slug ILIKE '%minuto%'");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

findTenant();
