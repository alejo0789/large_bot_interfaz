const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' }); // Adjust path if needed

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const migrationSQL = `
-- Add quick_replies table if not exists
CREATE TABLE IF NOT EXISTS quick_replies (
    id SERIAL PRIMARY KEY,
    shortcut VARCHAR(50) UNIQUE NOT NULL,
    content TEXT,
    media_url TEXT,
    media_type VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index forfaster search by shortcut if not exists
CREATE INDEX IF NOT EXISTS idx_quick_replies_shortcut ON quick_replies(shortcut);
`;

async function runMigration() {
    try {
        const client = await pool.connect();
        console.log('Running migration: create quick_replies table...');
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
