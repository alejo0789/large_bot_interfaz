const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'root',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'chatbot_master'
});

async function registerCali() {
    const caliUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require';

    try {
        console.log('📝 Registering Cali in Master DB...');
        await pool.query(`
            INSERT INTO tenants (name, slug, db_url, is_active) 
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (slug) DO UPDATE SET 
                db_url = EXCLUDED.db_url,
                is_active = EXCLUDED.is_active,
                name = EXCLUDED.name
        `, ['Cali', 'cali', caliUrl, true]);

        console.log('✅ Cali registered successfully!');

        const { rows } = await pool.query('SELECT * FROM tenants');
        console.log('Current Tenants:', rows);

    } catch (err) {
        console.error('❌ Error registering Cali:', err.message);
    } finally {
        await pool.end();
    }
}

registerCali();
