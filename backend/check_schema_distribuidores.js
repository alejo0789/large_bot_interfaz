const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require',
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    // 1. Check columns in conversations table
    const cols = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'conversations'
        ORDER BY ordinal_position
    `);
    console.log('--- Columnas en conversations ---');
    cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    // 2. Check columns in messages table
    const msgCols = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'messages'
        ORDER BY ordinal_position
    `);
    console.log('\n--- Columnas en messages ---');
    msgCols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    await pool.end();
}

checkSchema().catch(e => { console.error(e.message); pool.end(); });
