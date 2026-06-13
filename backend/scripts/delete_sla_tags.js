const { Pool } = require('pg');
const masterPool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require' });

(async () => {
    try {
        const { rows: tenants } = await masterPool.query('SELECT slug, db_url FROM tenants WHERE is_active = true');
        console.log(`Found ${tenants.length} active tenants.`);

        const tagsToDelete = ['LID_6H', 'LID_12H', 'LID_1D', 'LID_2D', 'LID_3D_PLUS'];

        for (const t of tenants) {
            if (!t.db_url) continue;
            const tenantPool = new Pool({ connectionString: t.db_url + (t.db_url.includes('?') ? '&' : '?') + 'sslmode=require' });
            try {
                // First, delete associations from conversation_tags
                const deleteAssocRes = await tenantPool.query(`
                    DELETE FROM conversation_tags 
                    WHERE tag_id IN (
                        SELECT id FROM tags WHERE name = ANY($1)
                    )
                `, [tagsToDelete]);

                // Then, delete the tags themselves
                const deleteTagsRes = await tenantPool.query(`
                    DELETE FROM tags 
                    WHERE name = ANY($1)
                `, [tagsToDelete]);

                console.log(`✅ Cleaned up tags for [${t.slug}]: Deleted ${deleteAssocRes.rowCount} associations, ${deleteTagsRes.rowCount} tags.`);
            } catch(e) {
                console.error(`❌ Error cleaning up [${t.slug}]:`, e.message);
            } finally {
                await tenantPool.end();
            }
        }
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
