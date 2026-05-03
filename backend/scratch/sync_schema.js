const { Client } = require('pg');

const targetDb = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/bucaramanga_paula_db?sslmode=require&channel_binding=require';
const sourceDb = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require';

async function getTables(connString) {
    const client = new Client({ connectionString: connString });
    await client.connect();
    const res = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    `);
    await client.end();
    return res.rows.map(r => r.table_name);
}

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
    const sourceTables = await getTables(sourceDb);
    const targetTables = await getTables(targetDb);
    
    const clientTarget = new Client({ connectionString: targetDb });
    await clientTarget.connect();

    for (const table of sourceTables) {
        if (!targetTables.includes(table)) {
            console.log(`Table missing in target: ${table} (Skipping for now)`);
            continue;
        }
        
        const targetCols = await describeTable(targetDb, table);
        const sourceCols = await describeTable(sourceDb, table);
        
        const targetColNames = targetCols.map(c => c.column_name);
        const missing = sourceCols.filter(c => !targetColNames.includes(c.column_name));
        
        if (missing.length > 0) {
            console.log(`\nTable ${table} is missing columns:`);
            for (const col of missing) {
                console.log(`- ${col.column_name} (${col.data_type})`);
                // Generate and execute alter statement
                let query = `ALTER TABLE ${table} ADD COLUMN "${col.column_name}" ${col.data_type}`;
                if (col.data_type === 'boolean') {
                    query += ` DEFAULT false`;
                }
                console.log(`Executing: ${query}`);
                await clientTarget.query(query);
                console.log(`Successfully added ${col.column_name} to ${table}.`);
            }
        }
    }
    await clientTarget.end();
    console.log("Migration complete.");
}

run().catch(console.error);
