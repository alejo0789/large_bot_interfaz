const { Pool } = require('pg');

async function checkTags() {
    const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';
    const masterPool = new Pool({
        connectionString: masterUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await masterPool.query("SELECT db_url FROM tenants WHERE slug = 'cali'");
        if (res.rows.length === 0) return;
        
        const dbUrl = res.rows[0].db_url;
        const pool = new Pool({
            connectionString: dbUrl,
            ssl: { rejectUnauthorized: false }
        });

        try {
            const tagsRes = await pool.query("SELECT * FROM tags WHERE name ILIKE '%REMARKETING%' ORDER BY name");
            console.log("Current Remarketing Tags:", tagsRes.rows);

            for (let tag of tagsRes.rows) {
                const countRes = await pool.query("SELECT count(*) FROM conversation_tags WHERE tag_id = $1", [tag.id]);
                console.log(`Tag ${tag.name} (ID: ${tag.id}) has ${countRes.rows[0].count} conversations.`);
            }
        } finally {
            await pool.end();
        }
    } finally {
        await masterPool.end();
    }
}

checkTags();
