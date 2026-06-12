const { Client } = require('pg');

async function findUser() {
    const masterClient = new Client({
        connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require'
    });
    await masterClient.connect();

    const res = await masterClient.query("SELECT * FROM users WHERE id = '4118866c-108b-448f-a931-56758c00e9cf'");
    console.log(res.rows[0]);
    await masterClient.end();
}

findUser().catch(console.error);
