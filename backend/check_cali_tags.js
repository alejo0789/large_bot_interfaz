const { Pool } = require('pg');

const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function run() {
    let pool = new Pool({ connectionString: masterUrl, ssl: { rejectUnauthorized: false } });
    
    try {
        const { rows } = await pool.query("SELECT db_url FROM tenants WHERE slug = 'cali'");
        if (rows.length === 0) {
            console.log("Cali tenant not found in master.");
            return;
        }
        const caliUrl = rows[0].db_url;
        console.log("Cali URL:", caliUrl);
        await pool.end();

        // Connect to Cali
        pool = new Pool({ connectionString: caliUrl, ssl: { rejectUnauthorized: false } });
        
        // Find tags
        const tagsResult = await pool.query("SELECT * FROM tags WHERE name ILIKE 'REMARKETING %' ORDER BY name");
        console.log("Tags:", tagsResult.rows);

        const targetTags = ['REMARKETING 00', 'REMARKETING 01', 'REMARKETING 02', 'REMARKETING 03', 'REMARKETING 04', 'REMARKETING 05'];
        const tagIds = tagsResult.rows.filter(t => targetTags.includes(t.name.toUpperCase())).map(t => t.id);
        
        console.log("Target Tag IDs:", tagIds);
        
        if (tagIds.length === 0) {
            console.log("No matching tags found.");
            return;
        }

        const tagIdsStr = tagIds.join(',');

        const multiTagContacts = await pool.query(`
            SELECT conversation_phone, COUNT(tag_id) as tag_count, array_agg(tag_id) as tag_ids
            FROM conversation_tags
            WHERE tag_id IN (${tagIdsStr})
            GROUP BY conversation_phone
            HAVING COUNT(tag_id) >= 2
        `);

        console.log(`Contacts with >=2 tags among remarketing 00-05: ${multiTagContacts.rows.length}`);
        
        if (multiTagContacts.rows.length > 0) {
            console.log("Sample of 5 contacts:");
            console.log(multiTagContacts.rows.slice(0, 5));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

run();
