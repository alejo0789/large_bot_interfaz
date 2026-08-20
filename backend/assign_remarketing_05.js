const { Pool } = require('pg');

const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function run() {
    let pool = new Pool({ connectionString: masterUrl, ssl: { rejectUnauthorized: false } });
    
    try {
        const { rows } = await pool.query("SELECT db_url FROM tenants WHERE slug = 'cali'");
        const caliUrl = rows[0].db_url;
        await pool.end();

        pool = new Pool({ connectionString: caliUrl, ssl: { rejectUnauthorized: false } });
        
        // 1. Ensure REMARKETING 05 exists
        let tagRes = await pool.query("SELECT id FROM tags WHERE name = 'REMARKETING 05'");
        let tagId;
        
        if (tagRes.rows.length === 0) {
            console.log("REMARKETING 05 does not exist. Creating it...");
            // Use a color, e.g., '#EC4899' (pink) or any other distinct color
            const insertRes = await pool.query("INSERT INTO tags (name, color) VALUES ('REMARKETING 05', '#EC4899') RETURNING id");
            tagId = insertRes.rows[0].id;
        } else {
            tagId = tagRes.rows[0].id;
        }
        
        console.log(`REMARKETING 05 tag ID is: ${tagId}`);

        // 2. Find conversations without ANY tags
        const untaggedContacts = await pool.query(`
            SELECT phone 
            FROM conversations 
            WHERE phone NOT IN (
                SELECT DISTINCT conversation_phone 
                FROM conversation_tags
            )
        `);

        console.log(`Found ${untaggedContacts.rows.length} chats without any tags.`);

        if (untaggedContacts.rows.length === 0) {
            console.log("No untagged chats found. Exiting.");
            return;
        }

        // 3. Assign REMARKETING 05
        console.log("Assigning REMARKETING 05...");
        
        // We can batch insert to make it faster
        let insertedCount = 0;
        const batchSize = 1000;
        const phones = untaggedContacts.rows.map(r => r.phone);
        
        for (let i = 0; i < phones.length; i += batchSize) {
            const batch = phones.slice(i, i + batchSize);
            
            // Build the multi-insert string
            const values = batch.map((phone, idx) => `($${idx + 1}, ${tagId}, NOW(), 'system')`).join(', ');
            
            await pool.query(`
                INSERT INTO conversation_tags (conversation_phone, tag_id, assigned_at, assigned_by) 
                VALUES ${values}
                ON CONFLICT (conversation_phone, tag_id) DO NOTHING
            `, batch);
            
            insertedCount += batch.length;
        }

        console.log(`Successfully assigned REMARKETING 05 to ${insertedCount} untagged chats.`);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

run();
