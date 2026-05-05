require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const masterPool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

const villaPool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/villavicencio?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

const bogotaPool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/bogota.paula?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function syncAgents() {
    try {
        console.log('--- Fetching paula.arjona from Master ---');
        const userRes = await masterPool.query("SELECT * FROM users WHERE username = 'paula.arjona'");
        if (userRes.rows.length === 0) {
            console.error('User paula.arjona not found in master');
            return;
        }
        const user = userRes.rows[0];

        const tenantPools = [
            { name: 'villavicencio', pool: villaPool },
            { name: 'bogota.paula', pool: bogotaPool }
        ];

        for (const { name, pool } of tenantPools) {
            console.log(`\n--- Syncing paula.arjona to ${name} ---`);
            
            // Check if agent exists
            const existing = await pool.query("SELECT * FROM agents WHERE username = 'paula.arjona'");
            
            if (existing.rows.length === 0) {
                await pool.query(
                    `INSERT INTO agents (id, username, password_hash, name, email, is_active, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [user.id, user.username, user.password_hash, user.full_name, user.email, user.is_active, user.created_at]
                );
                console.log(`✅ Agent created in ${name}`);
            } else {
                // Update just in case
                await pool.query(
                    `UPDATE agents SET password_hash = $1, name = $2, email = $3, is_active = $4 WHERE id = $5`,
                    [user.password_hash, user.full_name, user.email, user.is_active, user.id]
                );
                console.log(`ℹ️ Agent updated in ${name}`);
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await masterPool.end();
        await villaPool.end();
        await bogotaPool.end();
    }
}

syncAgents();
