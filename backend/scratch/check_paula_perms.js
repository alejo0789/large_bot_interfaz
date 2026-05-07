const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkStatus() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to chatbot_master');

    console.log('\n--- Tenants ---');
    const tenantsRes = await client.query('SELECT id, name, slug FROM tenants');
    console.table(tenantsRes.rows);

    console.log('\n--- User Paula Arjona ---');
    const userRes = await client.query("SELECT id, username, full_name, role FROM users WHERE username = 'paula.arjona'");
    console.table(userRes.rows);

    if (userRes.rows.length > 0) {
      const userId = userRes.rows[0].id;
      console.log('\n--- Current Tenant Assignments for Paula ---');
      const assignmentsRes = await client.query(`
        SELECT t.name, t.slug 
        FROM user_tenants ut 
        JOIN tenants t ON ut.tenant_id = t.id 
        WHERE ut.user_id = $1
      `, [userId]);
      console.table(assignmentsRes.rows);
    } else {
      console.log('User paula.arjona not found.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkStatus();
