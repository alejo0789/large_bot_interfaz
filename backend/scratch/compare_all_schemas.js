const { Client } = require('pg');

async function getTableSchema(dbUrl, tableName) {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
    FROM information_schema.columns 
    WHERE table_name = $1
  `, [tableName]);
  await client.end();
  return res.rows;
}

async function getTables(dbUrl) {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  await client.end();
  return res.rows.map(r => r.table_name);
}

async function check() {
  const caliUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require';
  const valleduparUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/valledupar_paula?sslmode=require&channel_binding=require';

  const caliTables = await getTables(caliUrl);
  
  for (const table of caliTables) {
    const caliSchema = await getTableSchema(caliUrl, table);
    const valleduparSchema = await getTableSchema(valleduparUrl, table);
    
    if (valleduparSchema.length === 0) {
      console.log("Table " + table + " is missing in Valledupar");
      continue;
    }
    
    const missing = caliSchema.filter(c => !valleduparSchema.find(v => v.column_name === c.column_name));
    if (missing.length > 0) {
      console.log("\nMissing columns in Valledupar for table " + table + ":");
      console.log(missing.map(m => m.column_name + " (" + m.data_type + ")"));
    }
  }
}

check().catch(console.error);
