const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/pereira_db?sslmode=require&channel_binding=require';

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    const client = await pool.connect();
    try {
        console.log('Checking conversations table columns...');
        const { rows } = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'conversations'
        `);
        
        console.log('Columns in conversations:');
        rows.forEach(r => console.log(`- ${r.column_name}`));
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkSchema();
