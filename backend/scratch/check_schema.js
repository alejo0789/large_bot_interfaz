const { Client } = require('pg');

const targetDb = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/bucaramanga_paula_db?sslmode=require&channel_binding=require';

// Known working db
const sourceDb = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require';

async function describeTable(connString, tableName) {
    const client = new Client({ connectionString: connString });
    await client.connect();
    const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
    `, [tableName]);
    await client.end();
    return res.rows;
}

async function run() {
    const targetCols = await describeTable(targetDb, 'conversations');
    const sourceCols = await describeTable(sourceDb, 'conversations');
    
    const targetColNames = targetCols.map(c => c.column_name);
    const missing = sourceCols.filter(c => !targetColNames.includes(c.column_name));
    
    console.log("Missing columns in target DB 'conversations':", missing);
}

run().catch(console.error);
