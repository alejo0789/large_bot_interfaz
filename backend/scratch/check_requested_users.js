const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkUsers() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to master database');

        // 1. Check users
        const usersRes = await client.query('SELECT id, username, full_name, role FROM users WHERE username IN ($1, $2)', ['gustavo.castro', 'paula.arjona']);
        console.log('\n--- Users ---');
        console.table(usersRes.rows);

        // 2. Check tenants
        const tenantsRes = await client.query('SELECT id, name, slug FROM tenants WHERE slug IN ($1, $2, $3, $4)', ['paula', 'bogota.paula', 'villavicencio', 'bucaramnga_paula']);
        console.log('\n--- Tenants ---');
        console.table(tenantsRes.rows);

        // 3. Check associations
        const associationsRes = await client.query(`
            SELECT u.username, t.slug, u.role
            FROM users u
            JOIN user_tenants ut ON u.id = ut.user_id
            JOIN tenants t ON t.id = ut.tenant_id
            WHERE u.username IN ($1, $2)
        `, ['gustavo.castro', 'paula.arjona']);
        console.log('\n--- Current Associations ---');
        console.table(associationsRes.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkUsers();
