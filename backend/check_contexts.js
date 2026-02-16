const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const countRes = await pool.query('SELECT COUNT(*) FROM ai_knowledge');
        console.log(`Total contexts (rows in ai_knowledge): ${countRes.rows[0].count}`);

        // Get created_at too
        const rowsRes = await pool.query('SELECT id, content, embedding, created_at FROM ai_knowledge ORDER BY created_at ASC');

        console.log('\n--- Details of Contexts (Ordered by creation date) ---');
        rowsRes.rows.forEach((row, index) => {
            let embeddingStatus = "MISSING";
            let vectorLength = 0;

            if (row.embedding) {
                // pg-vector often returns a string representation like "[0.1,0.2,...]"
                const vectorStr = String(row.embedding);
                if (vectorStr.startsWith('[') && vectorStr.endsWith(']')) {
                    // Approximate counting
                    const parts = vectorStr.split(',');
                    vectorLength = parts.length;
                    embeddingStatus = `OK (Length: ${vectorLength})`;
                } else {
                    embeddingStatus = "UNKNOWN FORMAT";
                }
            }

            console.log(`\nContext #${index + 1} (Created: ${row.created_at})`);
            console.log(`ID: ${row.id}`);
            console.log(`Content Preview: ${row.content ? row.content.substring(0, 50) : 'NULL'}...`);
            console.log(`Embedding: ${embeddingStatus}`);
        });

    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await pool.end();
    }
}

check();
