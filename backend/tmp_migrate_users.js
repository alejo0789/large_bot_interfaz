const { Pool } = require('pg');

const CALI_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require";
const MASTER_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require";

async function migrate() {
    const caliPool = new Pool({ connectionString: CALI_DB_URL });
    const masterPool = new Pool({ connectionString: MASTER_DB_URL });

    try {
        console.log('🔍 Fetching agents from Cali database...');
        const { rows: agents } = await caliPool.query('SELECT username, password_hash, name, email FROM agents');

        console.log(`📦 Found ${agents.length} agents. Getting tenant ID for "cali"...`);
        const { rows: tenantRows } = await masterPool.query('SELECT id FROM tenants WHERE slug = $1', ['cali']);

        if (tenantRows.length === 0) {
            console.error('❌ Tenant "cali" not found in master database.');
            return;
        }
        const tenantId = tenantRows[0].id;

        for (const agent of agents) {
            try {
                console.log(`👤 Processing user: ${agent.username}`);

                // 1. Insert/Get user in Master
                let userId;
                const { rows: existingByUsername } = await masterPool.query('SELECT id FROM users WHERE username = $1', [agent.username]);

                if (existingByUsername.length > 0) {
                    userId = existingByUsername[0].id;
                    console.log(`   - User already exists by username (ID: ${userId})`);
                } else if (agent.email) {
                    const { rows: existingByEmail } = await masterPool.query('SELECT id FROM users WHERE email = $1', [agent.email]);
                    if (existingByEmail.length > 0) {
                        userId = existingByEmail[0].id;
                        console.log(`   - User profile already exists by email (ID: ${userId}). Using existing user record.`);
                    }
                }

                if (!userId) {
                    const { rows: newUser } = await masterPool.query(
                        'INSERT INTO users (username, password_hash, full_name, email, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                        [agent.username, agent.password_hash, agent.name, agent.email || null, 'OPERATOR']
                    );
                    userId = newUser[0].id;
                    console.log(`   - Created new user in Master (ID: ${userId})`);
                }

                // 2. Associate with tenant
                await masterPool.query(
                    'INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [userId, tenantId]
                );
                console.log(`   - Associated with tenant "cali"`);
            } catch (userErr) {
                console.warn(`   ⚠️ Failed to process user ${agent.username}: ${userErr.message}`);
                // Continue with next user
            }
        }

        console.log('✅ Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await caliPool.end();
        await masterPool.end();
    }
}

migrate();
