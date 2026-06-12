const { Client } = require('pg');

async function checkUsers() {
    const masterClient = new Client({
        connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require'
    });
    await masterClient.connect();

    console.log("=== MASTER USERS ===");
    try {
        const masterRes = await masterClient.query('SELECT * FROM users');
        console.table(masterRes.rows);
    } catch (e) {
        console.error(e.message);
    }
    await masterClient.end();
}

checkUsers().catch(console.error);
