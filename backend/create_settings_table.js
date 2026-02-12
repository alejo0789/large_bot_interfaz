const { Pool } = require('pg');
const { config } = require('./src/config/app');

// Hardcoded connection string just for this migration script to ensure it works regardless of .env loading
const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require';

const pool = new Pool({ connectionString });

async function migrate() {
    try {
        console.log('Creating settings table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value JSONB
            );
        `);

        // Insert default value if not exists
        await pool.query(`
            INSERT INTO settings (key, value) 
            VALUES ('default_ai_enabled', 'true') 
            ON CONFLICT (key) DO NOTHING;
        `);

        console.log('✅ Settings table created/verified.');
    } catch (err) {
        console.error('❌ Error creating table:', err);
    } finally {
        await pool.end();
    }
}

migrate();
