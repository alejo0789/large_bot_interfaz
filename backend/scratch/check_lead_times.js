require('dotenv').config();
const { Pool } = require('pg');
const masterUrl = process.env.MASTER_DATABASE_URL;
const pool = new Pool({ connectionString: masterUrl, ssl: { rejectUnauthorized: false } });

pool.query('SELECT slug, db_url FROM tenants').then(r => {
    const t = r.rows.find(x => x.slug === 'cali');
    if (!t) { console.log('No cali tenant'); pool.end(); return; }
    const tenantPool = new Pool({ connectionString: t.db_url, ssl: { rejectUnauthorized: false } });
    tenantPool.query('SELECT phone, last_message_from_me, lead_time FROM conversations WHERE lead_time IS NOT NULL LIMIT 10').then(res => {
        console.log('Conversations with lead_time in cali:');
        console.table(res.rows);
        tenantPool.query('SELECT COUNT(*) as total, SUM(CASE WHEN last_message_from_me = true THEN 1 ELSE 0 END) as answered, SUM(CASE WHEN last_message_from_me = false THEN 1 ELSE 0 END) as unanswered, SUM(CASE WHEN last_message_from_me IS NULL THEN 1 ELSE 0 END) as unknown FROM conversations WHERE lead_time IS NOT NULL').then(s => {
            console.log('\nStats for lead_time conversations:');
            console.table(s.rows);
            tenantPool.end(); pool.end();
        });
    });
});
