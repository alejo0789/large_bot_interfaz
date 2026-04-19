const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function cleanupTags() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('🚀 Starting tag cleanup for Cali...');

        // 1. Merge "Agendar" (262) and "agenda" (203) into "AGENDAR" (20)
        console.log('Merging AGENDAR tags...');
        await client.query(`
            UPDATE conversation_tags 
            SET tag_id = 20 
            WHERE tag_id IN (262, 203)
            ON CONFLICT (conversation_phone, tag_id) DO NOTHING;
        `);
        await client.query('DELETE FROM tags WHERE id IN (262, 203);');

        // 2. Merge "Soporte" (259) into "SOPORTE" (204)
        console.log('Merging SOPORTE tags...');
        await client.query(`
            UPDATE conversation_tags 
            SET tag_id = 204 
            WHERE tag_id = 259
            ON CONFLICT (conversation_phone, tag_id) DO NOTHING;
        `);
        await client.query('DELETE FROM tags WHERE id = 259;');

        console.log('✅ Cleanup complete!');

    } catch (err) {
        console.error('❌ Error during cleanup:', err.message);
    } finally {
        await client.end();
    }
}

cleanupTags();
