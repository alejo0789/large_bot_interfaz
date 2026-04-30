const { Pool } = require('pg');

const DATABASE_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require";

async function run() {
    console.log("🚀 Starting cleanup of empty conversations...");
    
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // 1. Identification
        const emptyConvsQuery = `
            SELECT phone, contact_name, created_at 
            FROM conversations c
            WHERE NOT EXISTS (
                SELECT 1 FROM messages m WHERE m.conversation_phone = c.phone
            )
        `;
        
        const { rows: emptyConvs } = await pool.query(emptyConvsQuery);
        console.log(`📊 Found ${emptyConvs.length} conversations with zero messages.`);

        if (emptyConvs.length === 0) {
            console.log("✅ No empty conversations found. Nothing to do.");
            return;
        }

        // 2. Deletion in bulk
        console.log("🗑️ Deleting empty conversations...");
        
        // We use a transaction to be safe
        await pool.query('BEGIN');
        
        // First, delete any tag assignments for these conversations (just in case)
        const deleteTagsQuery = `
            DELETE FROM conversation_tags 
            WHERE conversation_phone IN (
                SELECT phone FROM conversations c
                WHERE NOT EXISTS (
                    SELECT 1 FROM messages m WHERE m.conversation_phone = c.phone
                )
            )
        `;
        const tagsResult = await pool.query(deleteTagsQuery);
        console.log(`📍 Deleted ${tagsResult.rowCount} tag assignments.`);

        // Now delete the conversations
        const deleteConvsQuery = `
            DELETE FROM conversations c
            WHERE NOT EXISTS (
                SELECT 1 FROM messages m WHERE m.conversation_phone = c.phone
            )
        `;
        const convsResult = await pool.query(deleteConvsQuery);
        
        await pool.query('COMMIT');
        
        console.log(`✅ Successfully deleted ${convsResult.rowCount} empty conversations.`);

    } catch (err) {
        await pool.query('ROLLBACK').catch(() => {});
        console.error("❌ Error during cleanup:", err);
    } finally {
        await pool.end();
    }
}

run();
