const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkEnum() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log('--- User Role Enum Values ---');
    const res = await client.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'user_role'");
    console.log(res.rows.map(r => r.enumlabel));

    console.log('\n--- Paula Arjona Role ---');
    const userRes = await client.query("SELECT username, role FROM users WHERE username = 'paula.arjona'");
    console.log(userRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkEnum();
