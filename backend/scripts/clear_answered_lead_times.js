/**
 * One-time cleanup script: clears lead_time for all conversations that were already answered
 * (last_message_from_me = true OR NULL) across all tenant databases.
 * 
 * Run ONCE after deploying the SLA filter fix.
 * Usage: node scripts/clear_answered_lead_times.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const masterUrl = process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL;
if (!masterUrl) {
    console.error('❌ No MASTER_DATABASE_URL found in environment.');
    process.exit(1);
}

const isLocal = masterUrl.includes('localhost') || masterUrl.includes('127.0.0.1');
const useSsl = !isLocal && !masterUrl.includes('rlwy.net') && !masterUrl.includes('railway')
    ? { rejectUnauthorized: false }
    : false;

const masterPool = new Pool({ connectionString: masterUrl, ssl: useSsl });

async function run() {
    console.log('🔍 Fetching tenants from master...');
    const { rows: tenants } = await masterPool.query('SELECT id, slug, db_url FROM tenants');
    console.log(`Found ${tenants.length} tenants.\n`);

    for (const tenant of tenants) {
        if (!tenant.db_url) {
            console.warn(`⚠️  Tenant ${tenant.slug} has no db_url. Skipping.`);
            continue;
        }

        const tenantSsl = !tenant.db_url.includes('localhost') && !tenant.db_url.includes('127.0.0.1') && !tenant.db_url.includes('rlwy.net') && !tenant.db_url.includes('railway')
            ? { rejectUnauthorized: false }
            : false;

        const tenantPool = new Pool({ connectionString: tenant.db_url, ssl: tenantSsl });
        try {
            // Clear lead_time for conversations where:
            //   - We sent the last message (last_message_from_me = true)
            //   - OR the column is still NULL (old data)
            const result = await tenantPool.query(`
                UPDATE conversations 
                SET lead_time = NULL, updated_at = NOW()
                WHERE status = 'active'
                AND lead_time IS NOT NULL
                AND (last_message_from_me = true OR last_message_from_me IS NULL)
            `);
            console.log(`✅ [${tenant.slug}] Cleared lead_time on ${result.rowCount} answered conversations.`);
        } catch (err) {
            console.error(`❌ [${tenant.slug}] Error: ${err.message}`);
        } finally {
            await tenantPool.end();
        }
    }

    await masterPool.end();
    console.log('\n🎉 Done! All answered conversations have been cleaned up.');
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
