const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function cleanupTags() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('🚀 Starting robust tag cleanup for Cali...');

        // Function to safely merge tag A into tag B
        const mergeTags = async (sourceIds, targetId) => {
            console.log(`Merging tags ${sourceIds} into ${targetId}...`);
            
            // 1. Remove source tags from conversations that already HAVE the target tag
            // to avoid primary key collisions on the next update
            await client.query(`
                DELETE FROM conversation_tags 
                WHERE tag_id = ANY($1) 
                AND conversation_phone IN (
                    SELECT conversation_phone FROM conversation_tags WHERE tag_id = $2
                )
            `, [sourceIds, targetId]);

            // 2. Update remaining assignments to point to the target tag
            await client.query(`
                UPDATE conversation_tags 
                SET tag_id = $2 
                WHERE tag_id = ANY($1)
            `, [sourceIds, targetId]);

            // 3. Delete the redundant tags
            await client.query(`
                DELETE FROM tags WHERE id = ANY($1)
            `, [sourceIds]);
        };

        // Merge AGENDAR (20)
        await mergeTags([262, 203], 20);

        // Merge SOPORTE (204)
        await mergeTags([259], 204);

        console.log('✅ Cleanup complete!');

    } catch (err) {
        console.error('❌ Error during cleanup:', err.message);
    } finally {
        await client.end();
    }
}

cleanupTags();
