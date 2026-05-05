require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const masterPool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function updatePaulaAccess() {
    try {
        const userId = 'd31d4118-a6f7-4034-8434-a5f2edcc2d54'; // paula.arjona
        const tenantsToAdd = [
            '54aa9326-c6ec-4e42-8e8c-3809e4147309', // villavicencio
            '52a19f5e-c058-4891-8ba7-da8d7f582727'  // bogotapaula
        ];

        console.log(`--- Adding access for user paula.arjona to Villavicencio and Bogota.Paula ---`);

        for (const tenantId of tenantsToAdd) {
            // Check if mapping already exists
            const existing = await masterPool.query(
                "SELECT * FROM user_tenants WHERE user_id = $1 AND tenant_id = $2",
                [userId, tenantId]
            );

            if (existing.rows.length === 0) {
                await masterPool.query(
                    "INSERT INTO user_tenants (user_id, tenant_id, assigned_at) VALUES ($1, $2, NOW())",
                    [userId, tenantId]
                );
                console.log(`✅ Access added for tenant ID: ${tenantId}`);
            } else {
                console.log(`ℹ️ User already has access to tenant ID: ${tenantId}`);
            }
        }

        console.log('\n--- Final check of mappings for paula.arjona ---');
        const finalMappings = await masterPool.query(
            "SELECT ut.*, t.name, t.slug FROM user_tenants ut JOIN tenants t ON ut.tenant_id = t.id WHERE ut.user_id = $1",
            [userId]
        );
        console.table(finalMappings.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await masterPool.end();
    }
}

updatePaulaAccess();
