const { Pool } = require('pg');

const masterPool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require',
});

async function main() {
    try {
        // 1. Check if pgvector extension exists
        const extCheck = await masterPool.query("SELECT extname FROM pg_extension WHERE extname = 'vector';");
        console.log('pgvector extension installed?', extCheck.rows.length > 0 ? 'YES' : 'NO');

        // 2. If not, create it
        if (extCheck.rows.length === 0) {
            console.log('Installing pgvector extension...');
            await masterPool.query('CREATE EXTENSION IF NOT EXISTS vector;');
            console.log('✅ pgvector extension installed');
        }

        // 3. Check columns on ai_knowledge_global
        const cols = await masterPool.query(`
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'ai_knowledge_global' 
            ORDER BY ordinal_position;
        `);
        console.log('\n--- ai_knowledge_global columns ---');
        cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (${r.udt_name})`));

        // 4. Check if embedding column exists
        const hasEmbed = cols.rows.some(r => r.column_name === 'embedding');
        if (!hasEmbed) {
            console.log('\n⚠️ embedding column MISSING. Adding it now...');
            await masterPool.query('ALTER TABLE ai_knowledge_global ADD COLUMN embedding vector(3072);');
            console.log('✅ embedding column added!');
        } else {
            console.log('\n✅ embedding column already exists');
        }

        // 5. Check how many rows and how many have embeddings
        const stats = await masterPool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(embedding) as with_embedding,
                COUNT(*) - COUNT(embedding) as without_embedding
            FROM ai_knowledge_global;
        `);
        console.log('\n--- Stats ---');
        console.log(stats.rows[0]);

        // 6. Show rows without embeddings
        const missing = await masterPool.query(`
            SELECT id, title, LEFT(content, 80) as content_preview
            FROM ai_knowledge_global 
            WHERE embedding IS NULL
            ORDER BY created_at;
        `);
        if (missing.rows.length > 0) {
            console.log('\n--- Rows WITHOUT embedding ---');
            missing.rows.forEach(r => console.log(`  [${r.id}] ${r.title || '(no title)'}: ${r.content_preview || '(no content)'}`));
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await masterPool.end();
    }
}

main();
