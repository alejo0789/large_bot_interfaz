const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require';

async function fixTags() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        console.log('🔍 Fetching all tags...');
        const { rows: tags } = await client.query(`
            SELECT id, name, color 
            FROM tags 
            ORDER BY name
        `);
        
        const duplicates = {};
        for (const tag of tags) {
            const normalized = tag.name.toLowerCase().replace(/\s+/g, '');
            if (!duplicates[normalized]) duplicates[normalized] = [];
            duplicates[normalized].push(tag);
        }
        
        for (const [key, list] of Object.entries(duplicates)) {
            if (list.length > 1) {
                console.log(`Duplicate found for: ${key}`);
                console.table(list);
            }
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

fixTags();
