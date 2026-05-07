const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function findUsers() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('--- Gustavo/Castro ---');
  const res1 = await client.query("SELECT username FROM users WHERE username ILIKE '%gustavo%' OR username ILIKE '%castro%'");
  console.log(res1.rows);
  console.log('--- Felipe/Prieto ---');
  const res2 = await client.query("SELECT username FROM users WHERE username ILIKE '%felipe%' OR username ILIKE '%prieto%'");
  console.log(res2.rows);
  await client.end();
}
findUsers();
