const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require',
});
async function check() {
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log("Tables:", res.rows);

  const tenants = await client.query("SELECT * FROM tenants"); // Let's guess the table name is tenants
  console.log("Tenants:", tenants.rows);
  await client.end();
}
check().catch(e => { console.error(e.message); client.end(); });
