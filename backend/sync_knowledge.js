const { Pool } = require('pg');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const API_KEY = process.env.GOOGLE_AI_API_KEY;
const MODEL = "gemini-embedding-001"; // El nombre exacto es gemini-embedding-001

async function getEmbedding(text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: { parts: [{ text }] },
            output_dimensionality: 3072 // Cambiado a 3072 como solicitaste
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Google API Error: ${data.error?.message || 'Unknown error'}`);
    }
    return data.embedding.values;
}

async function sync() {
    console.log('🚀 Iniciando sincronización de vectores...');

    if (!API_KEY || API_KEY === 'tu_llave_aqui') {
        console.error('❌ Error: GOOGLE_AI_API_KEY no encontrada en el .env');
        process.exit(1);
    }

    try {
        // 1. Obtener filas sin embedding
        const { rows } = await pool.query('SELECT id, content FROM ai_knowledge WHERE embedding IS NULL');

        console.log(`📝 Encontradas ${rows.length} filas para procesar.`);

        for (const row of rows) {
            console.log(`🧬 Generando vector para ID: ${row.id}...`);
            try {
                const vector = await getEmbedding(row.id + " " + row.content);

                // 2. Guardar en la base de datos
                // El formato para PGVector es '[0.1, 0.2, ...]'
                const vectorString = `[${vector.join(',')}]`;

                await pool.query(
                    'UPDATE ai_knowledge SET embedding = $1, updated_at = NOW() WHERE id = $2',
                    [vectorString, row.id]
                );
                console.log(`✅ ID ${row.id} actualizado.`);
            } catch (err) {
                console.error(`❌ Error en fila ${row.id}:`, err.message);
            }
        }

        console.log('🏁 Proceso terminado.');
    } catch (err) {
        console.error('❌ Error fatal:', err);
    } finally {
        await pool.end();
    }
}

sync();
