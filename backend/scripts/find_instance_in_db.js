const { Pool } = require('pg');
require('dotenv').config();

async function findInstanceInDb(instanceName) {
    const masterUrl = process.env.MASTER_DATABASE_URL;
    const pool = new Pool({
        connectionString: masterUrl,
        ssl: masterUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        const { rows } = await pool.query("SELECT id, name, slug, evolution_instance FROM tenants WHERE evolution_instance = $1", [instanceName]);
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

const instanceName = 'large_sedeminutodios';
findInstanceInDb(instanceName);
