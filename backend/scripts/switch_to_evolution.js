const { Client } = require('pg');

const masterDbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require';

async function main() {
    const client = new Client({ connectionString: masterDbUrl });
    await client.connect();

    const cols = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'tenants'
        ORDER BY ordinal_position
    `);
    console.log('COLUMNS:', cols.rows.map(r => r.column_name));

    // Ver registro actual
    const checkRes = await client.query(`SELECT * FROM tenants WHERE slug = 'sedeminutodios'`);
    console.log('CURRENT MINUTO:', checkRes.rows[0]);

    // Cambiar whatsapp_provider a 'evolution'
    await client.query(`UPDATE tenants SET whatsapp_provider = 'evolution', updated_at = NOW() WHERE slug = 'sedeminutodios'`);
    console.log('UPDATED TO EVOLUTION!');

    const verify = await client.query(`SELECT slug, name, whatsapp_provider, wa_phone_number_id, wa_business_account_id, wa_verify_token, SUBSTRING(wa_access_token, 1, 20) as token_preview FROM tenants WHERE slug = 'sedeminutodios'`);
    console.log('VERIFY:', verify.rows[0]);

    await client.end();
}

main().catch(console.error);
