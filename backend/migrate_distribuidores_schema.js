const { Pool } = require('pg');

const TENANT_DB_URL = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require';

const pool = new Pool({
    connectionString: TENANT_DB_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    console.log('🚀 Aplicando migración de schema a distribuidor_ventas_db...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // lead columns
        await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_intent VARCHAR(50) DEFAULT NULL`);
        await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_time VARCHAR(50) DEFAULT NULL`);
        console.log('✅ lead_intent, lead_time agregados');

        // Check what other columns may be missing vs the reference schema
        // Check based on conversationService queries
        await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS conversation_state VARCHAR(50) DEFAULT 'ai_active'`);
        await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`);
        await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS profile_pic_url TEXT`);

        // Check messages table
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_internal_note BOOLEAN DEFAULT FALSE`);
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_name VARCHAR(100)`);
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255)`);
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'`);
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id VARCHAR(255)`);
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_text TEXT`);
        await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_sender VARCHAR(255)`);

        await client.query('COMMIT');
        console.log('✅ Todas las columnas verificadas/añadidas correctamente.');

        // Verify final schema
        const cols = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'conversations' ORDER BY ordinal_position
        `);
        console.log('\n--- Schema final de conversations ---');
        console.log(cols.rows.map(r => r.column_name).join(', '));

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error durante migración:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
