const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        const client = await pool.connect();
        console.log('Connected to DB');

        // Check if column exists
        const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='messages' AND column_name='agent_id';
    `);

        if (res.rows.length === 0) {
            console.log('Adding agent_id column...');
            await client.query(`ALTER TABLE messages ADD COLUMN agent_id VARCHAR(100);`);
            await client.query(`ALTER TABLE messages ADD COLUMN agent_name VARCHAR(100);`); // Optional but useful
            console.log('Columns added.');
        } else {
            console.log('Columns already exist.');
        }

        client.release();
        pool.end();
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
