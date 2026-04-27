const { Pool } = require('pg');

const MASTER_DB_URL = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';
const PEREIRA_DB_URL = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/pereira_db?sslmode=require&channel_binding=require';

async function fixPereiraSchema() {
    console.log('🚀 Iniciando corrección de esquema para pereira2...');
    
    const pool = new Pool({
        connectionString: PEREIRA_DB_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log('✅ Conectado a pereira_db');

        await client.query('BEGIN');

        console.log('Adding missing columns to conversations table...');
        
        // Add lead_intent
        await client.query(`
            ALTER TABLE conversations 
            ADD COLUMN IF NOT EXISTS lead_intent VARCHAR(255) DEFAULT NULL;
        `);
        console.log('- lead_intent added');

        // Add lead_time
        await client.query(`
            ALTER TABLE conversations 
            ADD COLUMN IF NOT EXISTS lead_time VARCHAR(255) DEFAULT NULL;
        `);
        console.log('- lead_time added');

        // Add last_message_from_me
        await client.query(`
            ALTER TABLE conversations 
            ADD COLUMN IF NOT EXISTS last_message_from_me BOOLEAN DEFAULT FALSE;
        `);
        console.log('- last_message_from_me added');
        
        // Add metadata
        await client.query(`
            ALTER TABLE conversations 
            ADD COLUMN IF NOT EXISTS metadata JSONB;
        `);
        console.log('- metadata added');

        // Add is_pinned (just in case)
        await client.query(`
            ALTER TABLE conversations 
            ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
        `);
        console.log('- is_pinned added');

        await client.query('COMMIT');
        console.log('✅ Columnas agregadas exitosamente.');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

fixPereiraSchema();
