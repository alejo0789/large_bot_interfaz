
const { Pool } = require('pg');
require('dotenv').config();

const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkTenants() {
    const pool = new Pool({
        connectionString: masterUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows } = await pool.query('SELECT * FROM tenants');
        console.log('Tenants in Master DB:');
        console.table(rows.map(r => ({ id: r.id, name: r.name, slug: r.slug, db: r.db_url.substring(0, 50) + '...' })));

        for (const tenant of rows) {
            console.log(`\n🔍 Checking DB for tenant: ${tenant.slug}`);
            const tPool = new Pool({
                connectionString: tenant.db_url,
                ssl: { rejectUnauthorized: false }
            });
            try {
                const { rows: tables } = await tPool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
                console.log(`   Tables: ${tables.map(t => t.table_name).join(', ')}`);
            } catch (e) {
                console.error(`   ❌ Error connecting to tenant DB: ${e.message}`);
            } finally {
                await tPool.end();
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkTenants();
