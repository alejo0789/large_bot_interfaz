const { Pool } = require('pg');

const dbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/producto_clientes_finales_db?sslmode=require';

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    console.log('Migrating producto_clientes_finales_db...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Adding lead_intent...');
        await client.query(`
            ALTER TABLE conversations 
            ADD COLUMN IF NOT EXISTS lead_intent VARCHAR(50) DEFAULT NULL;
        `);

        console.log('Adding lead_time...');
        await client.query(`
            ALTER TABLE conversations 
            ADD COLUMN IF NOT EXISTS lead_time VARCHAR(50) DEFAULT NULL;
        `);

        await client.query('COMMIT');
        console.log('Successfully added lead_intent and lead_time to conversations.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during migration:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
