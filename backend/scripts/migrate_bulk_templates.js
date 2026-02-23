const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const migrationSQL = `
CREATE TABLE IF NOT EXISTS bulk_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

async function runMigration() {
    try {
        const client = await pool.connect();
        console.log('Running migration: create bulk_templates table...');
        await client.query(migrationSQL);
        console.log('Migration successful!');
        client.release();
    } catch (err) {
        console.error('Error running migration:', err);
    } finally {
        pool.end();
    }
}

runMigration();
