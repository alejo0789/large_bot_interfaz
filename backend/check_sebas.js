const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const users = await pool.query('SELECT * FROM users WHERE username = $1', ['sebas.ventas']);
  console.log('User:', users.rows[0] || 'NOT FOUND');
  
  if (users.rows.length === 0) return pool.end();
  
  const tenants = await pool.query('SELECT id, name, slug FROM tenants');
  console.log('\nTenants:', tenants.rows);
  
  const links = await pool.query('SELECT * FROM tenant_users WHERE user_id = $1', [users.rows[0].id]);
  console.log('\nLinks for sebas.ventas:', links.rows);
  
  pool.end();
}
check().catch(console.error);
