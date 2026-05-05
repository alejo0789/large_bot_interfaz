const { Pool } = require('pg');

const DB_URL = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/bogota.paula?sslmode=require';

const pool = new Pool({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
});

async function main() {
    try {
        // Check tables
        const tables = await pool.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
        );
        console.log('=== EXISTING TABLES ===');
        tables.rows.forEach(r => console.log(' -', r.table_name));

        if (tables.rows.length === 0) {
            console.log('  (No tables found - database is empty)');
        } else {
            // For each table, show columns
            for (const t of tables.rows) {
                const cols = await pool.query(
                    "SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
                    [t.table_name]
                );
                console.log(`\n=== ${t.table_name} columns ===`);
                cols.rows.forEach(c => {
                    console.log(`  ${c.column_name} | ${c.data_type} | nullable: ${c.is_nullable} | default: ${c.column_default || 'none'}`);
                });
            }
        }

        // Compare conversations columns with expected
        const expected = [
            'phone', 'contact_name', 'profile_pic_url', 'status', 'conversation_state',
            'ai_enabled', 'agent_id', 'taken_by_agent_at', 'unread_count',
            'last_message_text', 'last_message_timestamp', 'last_message_from_me',
            'created_at', 'updated_at', 'is_pinned', 'lead_intent', 'lead_time', 'metadata'
        ];
        const convCols = await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations'"
        );
        const existing = convCols.rows.map(r => r.column_name);
        const missing = expected.filter(c => !existing.includes(c));
        
        console.log('\n=== MISSING COLUMNS IN conversations ===');
        if (missing.length === 0) {
            console.log('  ✅ None - all columns present!');
        } else {
            missing.forEach(c => console.log(`  ❌ ${c}`));
        }

    } catch (err) {
        console.error('ERROR:', err.message);
    } finally {
        await pool.end();
    }
}

main();
