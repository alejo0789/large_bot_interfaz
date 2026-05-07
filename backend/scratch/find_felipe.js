const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function findUser() {
  const client = new Client({ connectionString });
  await client.connect();
  const res = await client.query("SELECT username FROM users WHERE username ILIKE '%felipe%' OR username ILIKE '%prieto%'");
  console.log(res.rows);
  await client.end();
}
findUser();
