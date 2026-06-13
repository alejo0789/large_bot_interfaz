const { Pool } = require('pg');
const masterPool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require' });

(async () => {
    try {
        const { rows: tenants } = await masterPool.query('SELECT slug, db_url FROM tenants WHERE is_active = true');
        console.log('Found', tenants.length, 'active tenants');

        for (const t of tenants) {
            if (!t.db_url) {
                console.log('Skipping', t.slug, 'no db_url');
                continue;
            }
            try {
                const tenantPool = new Pool({ connectionString: t.db_url + (t.db_url.includes('?') ? '&' : '?') + 'sslmode=require' });
                await tenantPool.query(`
                    CREATE TABLE IF NOT EXISTS official_template_stats (
                        id SERIAL PRIMARY KEY,
                        template_name VARCHAR(255),
                        sent_count INT DEFAULT 0,
                        failed_count INT DEFAULT 0,
                        sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );
                `);
                console.log('✅ Created table for', t.slug);
                await tenantPool.end();
            } catch(e) {
                console.error('❌ Error for', t.slug, e.message);
            }
        }
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
