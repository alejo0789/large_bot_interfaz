const { Pool } = require('pg');
require('dotenv').config();

const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function migrate() {
    const masterPool = new Pool({
        connectionString: masterUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows: tenants } = await masterPool.query('SELECT * FROM tenants');
        console.log(`📋 Found ${tenants.length} tenants in master database.`);

        for (const tenant of tenants) {
            console.log(`\n⚙️ Migrating tenant database: ${tenant.name} (${tenant.slug})`);
            const tenantPool = new Pool({
                connectionString: tenant.db_url,
                ssl: { rejectUnauthorized: false }
            });

            try {
                // Add column
                await tenantPool.query(`
                    ALTER TABLE conversations 
                    ADD COLUMN IF NOT EXISTS channel character varying DEFAULT 'whatsapp_evolution';
                `);
                console.log(`   ✅ Channel column added/verified.`);

                // Update nulls
                const updateRes = await tenantPool.query(`
                    UPDATE conversations 
                    SET channel = 'whatsapp_evolution' 
                    WHERE channel IS NULL;
                `);
                console.log(`   ✅ Updated ${updateRes.rowCount} conversations to default 'whatsapp_evolution'.`);

            } catch (err) {
                console.error(`   ❌ Failed to migrate ${tenant.slug}:`, err.message);
            } finally {
                await tenantPool.end();
            }
        }
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await masterPool.end();
    }
}

migrate();
