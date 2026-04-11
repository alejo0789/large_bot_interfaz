const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

async function updateSebas() {
  const users = await pool.query("SELECT * FROM users WHERE username = 'sebas.ventas'");
  if (users.rows.length === 0) { console.log('User not found'); return pool.end(); }
  const userId = users.rows[0].id;
  
  // 1. Update role to LOCAL_ADMIN
  await pool.query("UPDATE users SET role = 'LOCAL_ADMIN' WHERE id = $1", [userId]);
  console.log('Role updated to LOCAL_ADMIN');
  
  // 2. Fetch target tenants
  const tenants = await pool.query("SELECT id, slug FROM tenants WHERE slug IN ('productosclientesfinales', 'distribuidoresventas2')");
  console.log('Target tenants:', tenants.rows.map(t => t.slug).join(', '));
  
  // 3. Clear existing user_tenants links and insert new ones
  await pool.query("DELETE FROM user_tenants WHERE user_id = $1", [userId]);
  
  for (const t of tenants.rows) {
     await pool.query("INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1, $2)", [userId, t.id]);
     console.log('Linked to:', t.slug);
  }
  
  pool.end();
}
updateSebas().catch(console.error);
