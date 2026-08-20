const { Pool } = require('pg');

const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function run() {
    let pool = new Pool({ connectionString: masterUrl, ssl: { rejectUnauthorized: false } });
    
    try {
        const { rows } = await pool.query("SELECT db_url FROM tenants WHERE slug = 'cali'");
        const caliUrl = rows[0].db_url;
        await pool.end();

        pool = new Pool({ connectionString: caliUrl, ssl: { rejectUnauthorized: false } });
        
        // Find tags
        const tagsResult = await pool.query("SELECT id, name FROM tags WHERE name ILIKE '%REMARKETING%' OR name ILIKE '%AGENDAD%'");
        console.log("Found relevant tags:", tagsResult.rows);
        
        const remarketingTags = tagsResult.rows.filter(t => t.name.toUpperCase().includes('REMARKETING'));
        const agendadoTags = tagsResult.rows.filter(t => t.name.toUpperCase().includes('AGENDAD'));

        if (agendadoTags.length === 0) {
            console.log("No AGENDADOS tag found.");
            return;
        }

        const agendadoIdsStr = agendadoTags.map(t => t.id).join(',');
        const remarketingIdsStr = remarketingTags.map(t => t.id).join(',');

        if (!remarketingIdsStr) {
            console.log("No REMARKETING tags found to remove.");
            return;
        }

        // Find contacts with both an AGENDADO tag AND a REMARKETING tag
        const contactsToClean = await pool.query(`
            SELECT DISTINCT c1.conversation_phone 
            FROM conversation_tags c1
            JOIN conversation_tags c2 ON c1.conversation_phone = c2.conversation_phone
            WHERE c1.tag_id IN (${agendadoIdsStr}) 
              AND c2.tag_id IN (${remarketingIdsStr})
        `);

        console.log(`Found ${contactsToClean.rows.length} contacts with both AGENDADOS and REMARKETING tags.`);

        let deletedCount = 0;
        for (const row of contactsToClean.rows) {
            const phone = row.conversation_phone;
            // Delete any remarketing tags for this phone
            const res = await pool.query(`
                DELETE FROM conversation_tags 
                WHERE conversation_phone = $1 
                  AND tag_id IN (${remarketingIdsStr})
            `, [phone]);
            deletedCount += res.rowCount;
            console.log(`Deleted ${res.rowCount} remarketing tag(s) for ${phone}`);
        }

        console.log(`\nCleanup complete! Removed ${deletedCount} REMARKETING tags from ${contactsToClean.rows.length} AGENDADOS contacts.`);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

run();
