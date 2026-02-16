const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const rowsRes = await pool.query('SELECT id, title, content, media_url FROM ai_knowledge ORDER BY created_at ASC');

        console.log('\n--- Contexts Media Check ---');
        rowsRes.rows.forEach((row, index) => {
            console.log(`\nContext #${index + 1}`);
            console.log(`ID: ${row.id}`);
            console.log(`Title: ${row.title || 'No Title'}`);
            console.log(`Content Preview: ${row.content ? row.content.substring(0, 50) : 'NULL'}...`);
            console.log(`Media URL: ${row.media_url || 'NULL'}`);
        });

    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await pool.end();
    }
}

check();
