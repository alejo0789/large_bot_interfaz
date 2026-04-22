require('dotenv').config();
const { Pool } = require('pg');

const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';
const masterPool = new Pool({ connectionString: masterUrl, ssl: { rejectUnauthorized: false } });

async function run() {
    const { rows: tenants } = await masterPool.query('SELECT slug, db_url FROM tenants');
    console.log(`Found ${tenants.length} tenants. Clearing all lead_time...\n`);

    for (const t of tenants) {
        if (!t.db_url) continue;
        const tp = new Pool({ connectionString: t.db_url, ssl: { rejectUnauthorized: false } });
        try {
            const r = await tp.query(`UPDATE conversations SET lead_time = NULL, updated_at = NOW() WHERE lead_time IS NOT NULL`);
            console.log(`✅ [${t.slug}] Cleared ${r.rowCount} lead_time entries.`);
        } catch (e) {
            console.error(`❌ [${t.slug}] ${e.message}`);
        } finally {
            await tp.end();
        }
    }
    await masterPool.end();
    console.log('\n🎉 Done! All lead_time cleared. The job will assign fresh ones on next run.');
}

run().catch(console.error);
