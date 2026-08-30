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

async function check() {
  const caliUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require';
  const valleduparUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/valledupar_paula?sslmode=require&channel_binding=require';

  const caliSchema = await getTableSchema(caliUrl, 'messages');
  const valleduparSchema = await getTableSchema(valleduparUrl, 'messages');

  console.log("Cali messages columns:", caliSchema.map(c => c.column_name));
  console.log("Valledupar messages columns:", valleduparSchema.map(c => c.column_name));

  const missing = caliSchema.filter(c => !valleduparSchema.find(v => v.column_name === c.column_name));
  console.log("\nMissing columns in Valledupar:");
  console.log(missing);
}

check().catch(console.error);
