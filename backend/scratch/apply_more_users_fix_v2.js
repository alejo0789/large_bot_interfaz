const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function applyPermissions() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to master DB.');

    // We'll apply to all likely candidates
    const usernames = ['gustavo.castro', 'felipe.prieto', 'Pipeprieto'];
    const slugs = ['bucaramangapaula', 'bogotapaula', 'villavicencio'];

    const tenantRes = await client.query("SELECT id, name FROM tenants WHERE slug = ANY($1)", [slugs]);
    const tenantIds = tenantRes.rows.map(r => r.id);

    for (const username of usernames) {
      console.log(`\nProcessing user: ${username}`);
      const userRes = await client.query("SELECT id FROM users WHERE username = $1", [username]);
      if (userRes.rows.length === 0) {
        console.warn(`User ${username} not found, skipping.`);
        continue;
      }
      const userId = userRes.rows[0].id;

      await client.query("UPDATE users SET role = 'SEDE_ADMIN' WHERE id = $1", [userId]);
      await client.query("DELETE FROM user_tenants WHERE user_id = $1", [userId]);
      for (const tenantId of tenantIds) {
        await client.query("INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1, $2)", [userId, tenantId]);
      }
      console.log(`Permissions applied to ${username}.`);
    }

    console.log('\n--- Final Verification ---');
    const finalRes = await client.query(`
      SELECT u.username, u.role, array_agg(t.name) as assigned_sedes
      FROM users u
      JOIN user_tenants ut ON u.id = ut.user_id
      JOIN tenants t ON ut.tenant_id = t.id
      WHERE u.username = ANY($1)
      GROUP BY u.id
    `, [usernames]);
    console.table(finalRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

applyPermissions();
