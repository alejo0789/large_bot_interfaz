const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require',
});
async function assign() {
  await client.connect();
  const userId = 'd31d4118-a6f7-4034-8434-a5f2edcc2d54';
  const tenantId = 'df0576ee-7f75-4a5a-807c-1946db624741';
  
  // Check if it already exists
  const check = await client.query('SELECT * FROM user_tenants WHERE user_id = $1 AND tenant_id = $2', [userId, tenantId]);
  if (check.rows.length > 0) {
    console.log("User already assigned to this tenant");
  } else {
    await client.query('INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1, $2)', [userId, tenantId]);
    console.log("Successfully assigned Paula to Valledupar");
  }
  
  await client.end();
}
assign().catch(e => { console.error(e.message); client.end(); });
