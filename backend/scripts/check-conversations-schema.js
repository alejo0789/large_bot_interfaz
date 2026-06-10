const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        const { rows: columns } = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'conversations'
            ORDER BY ordinal_position;
        `);

        console.log('\n📋 Conversations Table Schema:');
        console.log('========================');
        columns.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type}`);
        });
        console.log('========================\n');
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkSchema();
