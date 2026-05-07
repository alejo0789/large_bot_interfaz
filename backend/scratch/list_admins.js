const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkAdmins() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        const res = await client.query("SELECT username, role FROM users WHERE role IN ('SUPER_ADMIN', 'LOCAL_ADMIN', 'SEDE_ADMIN')");
        console.table(res.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkAdmins();
