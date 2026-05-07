const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkDetails() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        const users = await client.query("SELECT id, username, role FROM users WHERE username IN ('gustavo.castro', 'paula.arjona')");
        console.log('Users:', JSON.stringify(users.rows, null, 2));

        const tenants = await client.query("SELECT id, name, slug FROM tenants WHERE slug IN ('bucaramangapaula', 'villavicencio', 'bogotapaula')");
        console.log('Tenants:', JSON.stringify(tenants.rows, null, 2));

        const associations = await client.query(`
            SELECT u.username, t.slug 
            FROM user_tenants ut
            JOIN users u ON ut.user_id = u.id
            JOIN tenants t ON ut.tenant_id = t.id
            WHERE u.username IN ('gustavo.castro', 'paula.arjona')
        `);
        console.log('Associations:', JSON.stringify(associations.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkDetails();
