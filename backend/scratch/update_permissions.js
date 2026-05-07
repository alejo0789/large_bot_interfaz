const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function updatePermissions() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to database');

        // IDs from previous check
        const gustavoId = '462a738a-6c37-4181-8eb9-004dc315eb5c'; // gustavo.castro
        const villavicencioId = '54aa9326-c6ec-4e42-8e8c-3809e4147309';
        const bogotaId = '52a19f5e-c058-4891-8ba7-da8d7f582727';

        console.log('Updating gustavo.castro permissions...');
        
        // Add associations for Gustavo
        await client.query(`
            INSERT INTO user_tenants (user_id, tenant_id) 
            VALUES ($1, $2), ($1, $3)
            ON CONFLICT (user_id, tenant_id) DO NOTHING
        `, [gustavoId, villavicencioId, bogotaId]);

        console.log('Gustavo permissions updated.');

        // For Paula Arjona, she already has the associations and SEDE_ADMIN role.
        // I will just confirm her status.
        const paulaRes = await client.query("SELECT username, role FROM users WHERE username = 'paula.arjona'");
        console.log('Paula Arjona current role:', paulaRes.rows[0].role);

        const paulaTenants = await client.query(`
            SELECT t.slug FROM user_tenants ut 
            JOIN tenants t ON ut.tenant_id = t.id 
            WHERE ut.user_id = (SELECT id FROM users WHERE username = 'paula.arjona')
        `);
        console.log('Paula Arjona associated tenants:', paulaTenants.rows.map(r => r.slug));

        console.log('\n--- Final Verification ---');
        const finalRes = await client.query(`
            SELECT u.username, t.slug 
            FROM user_tenants ut
            JOIN users u ON ut.user_id = u.id
            JOIN tenants t ON ut.tenant_id = t.id
            WHERE u.username IN ('gustavo.castro', 'paula.arjona')
            ORDER BY u.username, t.slug
        `);
        console.table(finalRes.rows);

    } catch (err) {
        console.error('Error updating permissions:', err);
    } finally {
        await client.end();
    }
}

updatePermissions();
