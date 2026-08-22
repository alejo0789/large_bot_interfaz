const { Pool } = require('pg');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require',
});

const API_KEY = 'AIzaSyDiS4Br9LwafmpvZEiMyh8WUtdnP6iVW9I';

async function getEmbedding(text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${API_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: { parts: [{ text }] },
            output_dimensionality: 3072
        })
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Google API Error: ${data.error?.message || 'Unknown'}`);
    }
    return `[${data.embedding.values.join(',')}]`;
}

async function sync() {
    console.log('🚀 Sincronizando embeddings para ai_knowledge_global...');

    try {
        const { rows } = await pool.query(
            'SELECT id, title, content FROM ai_knowledge_global WHERE embedding IS NULL'
        );
        console.log(`📝 ${rows.length} filas sin embedding.`);

        let success = 0;
        let errors = 0;

        for (const row of rows) {
            const text = `${row.title || ''} ${row.content || ''}`.trim();
            if (!text) {
                console.log(`⏭️  [${row.id}] Sin texto, omitido.`);
                continue;
            }

            try {
                const vector = await getEmbedding(text);
                await pool.query(
                    'UPDATE ai_knowledge_global SET embedding = $1, updated_at = NOW() WHERE id = $2',
                    [vector, row.id]
                );
                success++;
                console.log(`✅ [${success}/${rows.length}] ${row.title || row.id}`);
                
                // Small delay to avoid rate limiting
                await new Promise(r => setTimeout(r, 200));
            } catch (err) {
                errors++;
                console.error(`❌ [${row.id}] ${row.title}: ${err.message}`);
            }
        }

        console.log(`\n🏁 Completado: ${success} éxitos, ${errors} errores de ${rows.length} total.`);

        // Verify
        const stats = await pool.query(
            'SELECT COUNT(*) as total, COUNT(embedding) as with_emb FROM ai_knowledge_global'
        );
        console.log('📊 Estado final:', stats.rows[0]);

    } catch (err) {
        console.error('❌ Error fatal:', err.message);
    } finally {
        await pool.end();
    }
}

sync();
