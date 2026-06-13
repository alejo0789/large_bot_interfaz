const { Pool } = require('pg');
const masterPool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require' });

(async () => {
    try {
        const { rows: tenants } = await masterPool.query('SELECT slug, db_url FROM tenants WHERE is_active = true');
        for (const t of tenants) {
            if (!t.db_url) continue;
            try {
                const tenantPool = new Pool({ connectionString: t.db_url + (t.db_url.includes('?') ? '&' : '?') + 'sslmode=require' });
                const { rows: tags } = await tenantPool.query("SELECT id, name FROM tags WHERE name ILIKE '%12%' OR name ILIKE '%1d%' OR name ILIKE '%lid%'");
                if (tags.length > 0) {
                    console.log(`Sede ${t.slug} has matching tags:`, tags);
                }
                await tenantPool.end();
            } catch(e) {
                // ignore
            }
        }
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
