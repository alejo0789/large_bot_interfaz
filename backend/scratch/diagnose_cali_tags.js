const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require';

async function diagnoseTags() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        console.log('🔍 Fetching all tags for Cali tenant...');
        const { rows: tags } = await client.query('SELECT * FROM tags');
        console.table(tags);
        
        const duplicates = tags.filter(t => 
            t.name.toLowerCase() === 'agendar' || 
            t.name.toLowerCase() === 'soporte' || 
            t.name.toLowerCase() === 'soport'
        );
        
        console.log('\nPotential duplicates found:');
        console.table(duplicates);
        
        // Count conversations for each potential duplicate
        for (const tag of duplicates) {
            const { rows: [{ count }] } = await client.query(
                'SELECT count(*) FROM conversation_tags WHERE tag_id = $1',
                [tag.id]
            );
            console.log(`Tag "${tag.name}" (ID: ${tag.id}) is used in ${count} conversations.`);
        }

    } catch (err) {
        console.error('❌ Error diagnosing tags:', err.message);
    } finally {
        await client.end();
    }
}

diagnoseTags();
