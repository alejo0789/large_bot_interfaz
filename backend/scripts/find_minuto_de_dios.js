const { Pool } = require('pg');
require('dotenv').config();

async function findMinutoDeDios() {
    const masterUrl = process.env.MASTER_DATABASE_URL;
    const pool = new Pool({
        connectionString: masterUrl,
        ssl: masterUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        const { rows } = await pool.query("SELECT * FROM tenants WHERE name ILIKE '%Minuto%Dios%' OR slug ILIKE '%minuto%dios%'");
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

findMinutoDeDios();
