require('dotenv').config();
const { Pool } = require('pg');

const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';
const masterPool = new Pool({ connectionString: masterUrl, ssl: { rejectUnauthorized: false } });

async function run() {
    const { rows: tenants } = await masterPool.query("SELECT slug, db_url FROM tenants WHERE slug = 'cali'");
    const t = tenants[0];
    const tp = new Pool({ connectionString: t.db_url, ssl: { rejectUnauthorized: false } });

    // Check all SLA buckets, split by answered/unanswered
    const s1 = await tp.query(`
        SELECT lead_time, last_message_from_me, COUNT(*) as total
        FROM conversations
        WHERE status = 'active' AND lead_time IS NOT NULL
        GROUP BY lead_time, last_message_from_me
        ORDER BY lead_time, last_message_from_me
    `);
    console.log('All SLA buckets by answered status:');
    console.table(s1.rows);

    // Sample answered conversations in 6H
    const s2 = await tp.query(`
        SELECT phone, last_message_from_me, lead_time, last_message_timestamp
        FROM conversations 
        WHERE status = 'active' AND lead_time = 'LID_6H' AND last_message_from_me = true
        LIMIT 5
    `);
    console.log('\nSample ANSWERED in 6H (should be empty):');
    console.table(s2.rows);

    await tp.end();
    await masterPool.end();
}

run().catch(console.error);
