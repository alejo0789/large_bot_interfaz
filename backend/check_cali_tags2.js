const { Pool } = require('pg');

const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function run() {
    let pool = new Pool({ connectionString: masterUrl, ssl: { rejectUnauthorized: false } });
    
    try {
        const { rows } = await pool.query("SELECT db_url FROM tenants WHERE slug = 'cali'");
        const caliUrl = rows[0].db_url;
        await pool.end();

        pool = new Pool({ connectionString: caliUrl, ssl: { rejectUnauthorized: false } });
        
        // Let's get ALL tags that match REMARKETING just in case
        const tagsResult = await pool.query("SELECT id, name FROM tags WHERE name ILIKE '%REMARKETING%'");
        console.log("All REMARKETING tags found in DB:", tagsResult.rows);
        
        const tagIds = tagsResult.rows.map(t => t.id);
        const tagIdsStr = tagIds.join(',');

        if (tagIds.length > 0) {
            const multiTagContacts = await pool.query(`
                SELECT conversation_phone, COUNT(tag_id) as tag_count, array_agg(tag_id) as tag_ids
                FROM conversation_tags
                WHERE tag_id IN (${tagIdsStr})
                GROUP BY conversation_phone
                HAVING COUNT(tag_id) >= 2
            `);
            
            console.log(`\nFound ${multiTagContacts.rows.length} contacts with multiple REMARKETING tags.`);
            if (multiTagContacts.rows.length > 0) {
                console.log("First 10 duplicates:");
                console.log(multiTagContacts.rows.slice(0, 10));
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

run();
