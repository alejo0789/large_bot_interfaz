const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkDatabase() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to database');

        // 1. Get Tenants
        console.log('\n--- Tenants ---');
        const tenantsRes = await client.query('SELECT id, name, slug FROM tenants');
        console.table(tenantsRes.rows);

        // 2. Get Users
        console.log('\n--- Users ---');
        const usersRes = await client.query("SELECT id, username, role FROM users WHERE username IN ('gustavo.castro', 'paula.arjona')");
        console.table(usersRes.rows);

        // 3. Get User-Tenant associations
        console.log('\n--- User Tenant Associations ---');
        const associationsRes = await client.query(`
            SELECT u.username, t.slug 
            FROM user_tenants ut
            JOIN users u ON ut.user_id = u.id
            JOIN tenants t ON ut.tenant_id = t.id
            WHERE u.username IN ('gustavo.castro', 'paula.arjona')
        `);
        console.table(associationsRes.rows);

    } catch (err) {
        console.error('Error checking database:', err);
    } finally {
        await client.end();
    }
}

checkDatabase();
