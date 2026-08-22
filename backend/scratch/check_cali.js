const { Client } = require('pg');

const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require';

async function checkCali() {
    const masterClient = new Client({ connectionString: masterUrl });
    try {
        await masterClient.connect();
        console.log('Connected to master DB.');

        const res = await masterClient.query("SELECT * FROM tenants WHERE slug = 'cali'");
        console.log('Cali tenant data:', JSON.stringify(res.rows[0], null, 2));

        if (res.rows.length > 0 && res.rows[0].db_url) {
            const caliDbUrl = res.rows[0].db_url;
            console.log('\nConnecting to Cali tenant DB...');
            const caliClient = new Client({ connectionString: caliDbUrl });
            await caliClient.connect();
            console.log('Connected to Cali tenant DB.');

            const tablesRes = await caliClient.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            `);
            console.log('Cali DB tables:', tablesRes.rows.map(r => r.table_name));

            await caliClient.end();
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await masterClient.end();
    }
}

checkCali();
