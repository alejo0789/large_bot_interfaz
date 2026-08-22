const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require',
});

const PUBLIC_URL = 'https://large.forsa.com.co';

async function main() {
    try {
        // Get all products with media_url that DON'T already have 📸 in content
        const { rows } = await pool.query(`
            SELECT id, title, content, media_url
            FROM ai_knowledge_global
            WHERE media_url IS NOT NULL 
              AND media_url != ''
              AND (content NOT LIKE '%📸 Imagen:%' OR content IS NULL)
        `);

        console.log(`📦 ${rows.length} productos con imagen que necesitan actualización.\n`);

        let updated = 0;
        for (const row of rows) {
            let imageUrl = row.media_url;
            // Make it a full URL if it starts with /uploads
            if (imageUrl.startsWith('/uploads')) {
                imageUrl = `${PUBLIC_URL}${imageUrl}`;
            }

            const newContent = `${row.content || ''}\n\n📸 Imagen: ${imageUrl}`;

            await pool.query(
                'UPDATE ai_knowledge_global SET content = $1, updated_at = NOW() WHERE id = $2',
                [newContent, row.id]
            );
            updated++;
            console.log(`✅ [${updated}] ${row.title} → ${imageUrl}`);
        }

        console.log(`\n🏁 ${updated} productos actualizados con URL de imagen en el content.`);

        // Show a sample
        const sample = await pool.query(`
            SELECT title, RIGHT(content, 120) as content_tail 
            FROM ai_knowledge_global 
            WHERE content LIKE '%📸 Imagen:%'
            LIMIT 3
        `);
        console.log('\n--- Muestra ---');
        sample.rows.forEach(r => console.log(`  ${r.title}: ...${r.content_tail}`));

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

main();
