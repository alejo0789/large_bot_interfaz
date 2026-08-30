const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require',
});
async function check() {
  await client.connect();
  const users = await client.query("SELECT id, username, role FROM users WHERE username LIKE '%paula%' OR username LIKE '%pula%'");
  console.log("Users:", users.rows);

  const tenants = await client.query("SELECT id, name, slug FROM tenants WHERE name ILIKE '%valledupar%' OR slug ILIKE '%valledupar%'");
  console.log("Tenants:", tenants.rows);
  
  await client.end();
}
check().catch(e => { console.error(e.message); client.end(); });
