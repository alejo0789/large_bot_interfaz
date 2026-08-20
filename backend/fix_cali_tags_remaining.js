const { Pool } = require('pg');

const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function run() {
    let pool = new Pool({ connectionString: masterUrl, ssl: { rejectUnauthorized: false } });
    
    try {
        const { rows } = await pool.query("SELECT db_url FROM tenants WHERE slug = 'cali'");
        const caliUrl = rows[0].db_url;
        await pool.end();

        pool = new Pool({ connectionString: caliUrl, ssl: { rejectUnauthorized: false } });
        
        const tagsResult = await pool.query("SELECT id, name FROM tags WHERE name ILIKE '%REMARKETING%'");
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
            
            console.log(`Found ${multiTagContacts.rows.length} remaining duplicates.`);
            
            for (const row of multiTagContacts.rows) {
                const phone = row.conversation_phone;
                const sortedTags = row.tag_ids.sort((a, b) => a - b);
                const tagsToRemove = sortedTags.slice(1); // keep the first one
                
                if (tagsToRemove.length > 0) {
                    const removeStr = tagsToRemove.join(',');
                    console.log(`Deleting ${removeStr} for ${phone}`);
                    await pool.query(`
                        DELETE FROM conversation_tags 
                        WHERE conversation_phone = $1 
                        AND tag_id IN (${removeStr})
                    `, [phone]);
                }
            }
        }
        
        console.log("Cleanup complete!");

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

run();
