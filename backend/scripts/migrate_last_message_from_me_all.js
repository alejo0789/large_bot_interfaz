const { Pool } = require('pg');
require('dotenv').config();

const masterPool = process.env.MASTER_DATABASE_URL
    ? new Pool({ 
        connectionString: process.env.MASTER_DATABASE_URL, 
        ssl: (process.env.MASTER_DATABASE_URL.includes('localhost') || process.env.MASTER_DATABASE_URL.includes('127.0.0.1')) 
            ? false 
            : { rejectUnauthorized: false } 
    })
    : new Pool({
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'root',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'chatbot_master'
    });

async function migrateAllTenants() {
    try {
        console.log('🔍 Fetching all active tenants from Master DB...');
        const { rows: tenants } = await masterPool.query('SELECT id, slug, db_url FROM tenants WHERE is_active = true');
        console.log(`Found ${tenants.length} tenants to migrate.`);

        for (const tenant of tenants) {
            console.log(`\n🏗️ Migrating tenant: ${tenant.slug}`);
            const tenantPool = new Pool({
                connectionString: tenant.db_url,
                ssl: tenant.db_url.includes('localhost') || tenant.db_url.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
            });

            try {
                // 1. Add column
                console.log(`  Adding 'last_message_from_me' column...`);
                await tenantPool.query(`
                    ALTER TABLE conversations 
                    ADD COLUMN IF NOT EXISTS last_message_from_me BOOLEAN DEFAULT false;
                `);

                // 2. Populate data
                console.log(`  Populating 'last_message_from_me' from historical data...`);
                const updateQuery = `
                    UPDATE conversations c 
                    SET last_message_from_me = (
                        SELECT (sender = 'me' OR sender = 'agent' OR sender = 'ai') 
                        FROM messages m 
                        WHERE m.conversation_phone = c.phone 
                        ORDER BY timestamp DESC 
                        LIMIT 1
                    ) 
                    WHERE EXISTS (
                        SELECT 1 
                        FROM messages m 
                        WHERE m.conversation_phone = c.phone
                    );
                `;
                const updateResult = await tenantPool.query(updateQuery);
                console.log(`  ✅ Migration complete. Updated ${updateResult.rowCount} conversations.`);

            } catch (err) {
                console.error(`  ❌ Error migrating ${tenant.slug}:`, err.message);
            } finally {
                await tenantPool.end();
            }
        }
    } catch (error) {
        console.error('❌ Master Error:', error.message);
    } finally {
        await masterPool.end();
    }
}

migrateAllTenants();
