const { Pool } = require('pg');

const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function run() {
    let pool = new Pool({ connectionString: masterUrl, ssl: { rejectUnauthorized: false } });
    
    try {
        const { rows } = await pool.query("SELECT db_url FROM tenants WHERE slug = 'cali'");
        if (rows.length === 0) {
            console.log("Cali tenant not found.");
            return;
        }
        const caliUrl = rows[0].db_url;
        await pool.end();

        pool = new Pool({ connectionString: caliUrl, ssl: { rejectUnauthorized: false } });
        
        const targetTags = ['REMARKETING 00', 'REMARKETING 01', 'REMARKETING 02', 'REMARKETING 03', 'REMARKETING 04', 'REMARKETING 05'];
        const tagsResult = await pool.query("SELECT * FROM tags WHERE name ILIKE 'REMARKETING %'");
        const tagIds = tagsResult.rows.filter(t => targetTags.includes(t.name.toUpperCase())).map(t => t.id);
        
        if (tagIds.length === 0) {
            console.log("No REMARKETING tags found.");
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

        console.log(`Found ${multiTagContacts.rows.length} contacts with multiple REMARKETING tags.`);
        
        if (multiTagContacts.rows.length === 0) {
            console.log("No duplicates to fix.");
            return;
        }

        let totalDeleted = 0;
        
        // Begin Transaction
        await pool.query('BEGIN');
        
        for (const row of multiTagContacts.rows) {
            const phone = row.conversation_phone;
            // Sort to keep the lowest tag_id (e.g. REMARKETING 00 over REMARKETING 01)
            const sortedTags = row.tag_ids.sort((a, b) => a - b);
            const tagToKeep = sortedTags[0];
            const tagsToRemove = sortedTags.slice(1);
            
            if (tagsToRemove.length > 0) {
                const removeStr = tagsToRemove.join(',');
                await pool.query(`
                    DELETE FROM conversation_tags 
                    WHERE conversation_phone = $1 
                    AND tag_id IN (${removeStr})
                `, [phone]);
                totalDeleted += tagsToRemove.length;
            }
        }

        // await pool.query('ROLLBACK'); // testing
        await pool.query('COMMIT');
        
        console.log(`Successfully fixed. Removed ${totalDeleted} duplicate tags across ${multiTagContacts.rows.length} contacts.`);
        console.log(`Contacts now only have the lowest numbered REMARKETING tag they were associated with.`);
        
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error(e);
    } finally {
        await pool.end();
    }
}

run();
