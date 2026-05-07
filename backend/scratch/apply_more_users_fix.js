const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function applyPermissions() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to master DB.');

    const usernames = ['gustavo.castro', 'felipe.prieto'];
    const slugs = ['bucaramangapaula', 'bogotapaula', 'villavicencio'];

    // 1. Get tenant IDs
    const tenantRes = await client.query("SELECT id, name FROM tenants WHERE slug = ANY($1)", [slugs]);
    const tenantIds = tenantRes.rows.map(r => r.id);

    if (tenantIds.length < 3) {
      console.warn(`Only found ${tenantIds.length} out of 3 tenants. Check slugs!`);
      console.log('Found:', tenantRes.rows.map(r => r.name));
    }

    for (const username of usernames) {
      console.log(`\nProcessing user: ${username}`);
      
      // 2. Find user
      const userRes = await client.query("SELECT id FROM users WHERE username = $1", [username]);
      if (userRes.rows.length === 0) {
        console.error(`User ${username} not found!`);
        continue;
      }
      const userId = userRes.rows[0].id;

      // 3. Update role to SEDE_ADMIN
      await client.query("UPDATE users SET role = 'SEDE_ADMIN' WHERE id = $1", [userId]);
      console.log(`User ${username} role updated to SEDE_ADMIN.`);

      // 4. Sync assignments
      // Delete existing assignments for these specific tenants (or all, if they should only have these 3)
      // The request says "igual que paula", so I'll make it exactly those 3.
      await client.query("DELETE FROM user_tenants WHERE user_id = $1", [userId]);
      
      for (const tenantId of tenantIds) {
        await client.query("INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [userId, tenantId]);
      }
      console.log(`Tenant assignments synced for ${username}.`);
    }

    console.log('\n--- Final Verification ---');
    for (const username of usernames) {
      const statusRes = await client.query(`
        SELECT u.username, u.role, array_agg(t.name) as assigned_sedes
        FROM users u
        LEFT JOIN user_tenants ut ON u.id = ut.user_id
        LEFT JOIN tenants t ON ut.tenant_id = t.id
        WHERE u.username = $1
        GROUP BY u.id
      `, [username]);
      console.table(statusRes.rows);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

applyPermissions();
