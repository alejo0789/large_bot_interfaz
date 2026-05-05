const { Pool } = require('pg');

const DB_URL = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/bogota.paula?sslmode=require';

const pool = new Pool({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
});

async function fixSchema() {
    const client = await pool.connect();
    try {
        console.log('🔧 Adding missing columns to bogota.paula conversations table...');
        
        await client.query('BEGIN');

        await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_from_me BOOLEAN DEFAULT FALSE;`);
        console.log('  ✅ last_message_from_me added');

        await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_intent VARCHAR(255);`);
        console.log('  ✅ lead_intent added');

        await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_time VARCHAR(255);`);
        console.log('  ✅ lead_time added');

        await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS metadata JSONB;`);
        console.log('  ✅ metadata added');

        await client.query('COMMIT');
        console.log('\n✅ All missing columns added successfully!');

        // Verify
        const { rows } = await client.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' ORDER BY ordinal_position"
        );
        console.log('\n=== Conversations columns (after fix) ===');
        rows.forEach(r => console.log('  -', r.column_name));

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

fixSchema();
