
const { Pool } = require('pg');

async function checkMessages() {
    const dbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/alejo_wp?sslmode=require&channel_binding=require';
    const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows } = await pool.query('SELECT count(*) FROM messages');
        console.log(`Total messages in alejo-wp2: ${rows[0].count}`);

        const { rows: recent } = await pool.query('SELECT id, sender, text_content, timestamp FROM messages ORDER BY timestamp DESC LIMIT 5');
        console.log('Recent messages:');
        console.log(JSON.stringify(recent, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkMessages();
