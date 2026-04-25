const { Pool } = require('pg');
const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkMasterAgent() {
    const pool = new Pool({
        connectionString: masterUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const targetId = 'e1bc1d31-7745-4c6e-b373-778deae76fca';
        const { rows } = await pool.query("SELECT id, username, full_name, email, role FROM users WHERE id = $1", [targetId]);
        console.log('Agent in Master DB:', rows[0]);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkMasterAgent();
