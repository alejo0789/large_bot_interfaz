const { Client } = require('pg');
const CALI_DB_URL = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require';

async function run() {
    const client = new Client(CALI_DB_URL);
    await client.connect();

    // Check conversations PK
    const { rows } = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'conversations' 
        ORDER BY ordinal_position 
        LIMIT 10
    `);
    console.log('=== conversations columns ===');
    rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

    await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
