const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function listAll() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log('--- ALL TENANTS ---');
    const tenants = await client.query("SELECT id, name, slug FROM tenants");
    console.log(tenants.rows);

    console.log('\n--- PAULA USER ---');
    const user = await client.query("SELECT id, username, role FROM users WHERE username = 'paula.arjona'");
    console.log(user.rows);

    if (user.rows.length > 0) {
      console.log('\n--- PAULA ASSIGNMENTS ---');
      const assig = await client.query("SELECT t.name, t.slug FROM user_tenants ut JOIN tenants t ON ut.tenant_id = t.id WHERE ut.user_id = $1", [user.rows[0].id]);
      console.log(assig.rows);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

listAll();
