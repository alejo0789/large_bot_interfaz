const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function applyFix() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to master DB.');

    // 1. Find user
    const userRes = await client.query("SELECT id FROM users WHERE username = 'paula.arjona'");
    if (userRes.rows.length === 0) {
      console.error('User paula.arjona not found!');
      return;
    }
    const userId = userRes.rows[0].id;

    // 2. Update role to SEDE_ADMIN
    await client.query("UPDATE users SET role = 'SEDE_ADMIN' WHERE id = $1", [userId]);
    console.log('User role updated to SEDE_ADMIN.');

    // 3. Define target tenants
    const slugs = ['bucaramangapaula', 'bogotapaula', 'villavicencio'];
    const tenantRes = await client.query("SELECT id, name FROM tenants WHERE slug = ANY($1)", [slugs]);
    const tenantIds = tenantRes.rows.map(r => r.id);

    if (tenantIds.length < 3) {
      console.warn(`Only found ${tenantIds.length} out of 3 tenants. Check slugs!`);
      console.log('Found:', tenantRes.rows.map(r => r.name));
    }

    // 4. Sync assignments
    // Delete existing assignments (to make it exactly those 3)
    await client.query("DELETE FROM user_tenants WHERE user_id = $1", [userId]);
    
    // Insert new assignments
    for (const tenantId of tenantIds) {
      await client.query("INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [userId, tenantId]);
    }
    console.log('Tenant assignments synced.');

    console.log('\nFinal Status:');
    const finalUser = await client.query("SELECT username, role FROM users WHERE id = $1", [userId]);
    console.log(finalUser.rows);
    const finalAssig = await client.query("SELECT t.name FROM user_tenants ut JOIN tenants t ON ut.tenant_id = t.id WHERE ut.user_id = $1", [userId]);
    console.log('Assigned to:', finalAssig.rows.map(r => r.name));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

applyFix();
