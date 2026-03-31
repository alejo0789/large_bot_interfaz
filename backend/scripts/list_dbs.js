const { Client } = require('pg');
require('dotenv').config();

async function listDbs() {
    // Connect to simple postgres database to list other databases
    const url = "postgresql://postgres:root@localhost:5432/postgres";
    const client = new Client({ connectionString: url });

    try {
        await client.connect();
        const { rows } = await client.query("SELECT datname FROM pg_database WHERE datname NOT LIKE 'pg_%' AND datname != 'information_schema'");
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

listDbs();
