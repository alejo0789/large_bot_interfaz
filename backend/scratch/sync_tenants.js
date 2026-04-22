const { Pool } = require('pg');

const prodUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';
const localUrl = 'postgresql://postgres:root@localhost:5432/chatbot_master';

const prodPool = new Pool({
  connectionString: prodUrl,
});

const localPool = new Pool({
  connectionString: localUrl,
});

async function run() {
  try {
    const { rows: prodTenants } = await prodPool.query('SELECT * FROM tenants');
    console.log('Production tenants:', prodTenants.length);
    prodTenants.forEach(t => console.log(`- ${t.slug} (${t.name})`));

    // Now insert them into local
    for (const t of prodTenants) {
      await localPool.query(`
        INSERT INTO tenants (
            id, name, slug, db_url, evolution_instance, n8n_webhook_url, is_active, 
            whatsapp_provider, wa_phone_number_id, wa_access_token, wa_verify_token,
            evolution_api_key, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13, $14
        ) ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            db_url = EXCLUDED.db_url,
            evolution_instance = EXCLUDED.evolution_instance,
            n8n_webhook_url = EXCLUDED.n8n_webhook_url,
            is_active = EXCLUDED.is_active,
            whatsapp_provider = EXCLUDED.whatsapp_provider,
            wa_phone_number_id = EXCLUDED.wa_phone_number_id,
            wa_access_token = EXCLUDED.wa_access_token,
            wa_verify_token = EXCLUDED.wa_verify_token,
            evolution_api_key = EXCLUDED.evolution_api_key
      `, [
        t.id, t.name, t.slug, t.db_url, t.evolution_instance, t.n8n_webhook_url, t.is_active,
        t.whatsapp_provider, t.wa_phone_number_id, t.wa_access_token, t.wa_verify_token,
        t.evolution_api_key, t.created_at, t.updated_at
      ]);
      console.log(`✅ Synced tenant: ${t.slug}`);
    }
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prodPool.end();
    await localPool.end();
  }
}

run();
