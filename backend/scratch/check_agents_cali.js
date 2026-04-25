const { Pool } = require('pg');
const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkAgents() {
    const pool = new Pool({
        connectionString: masterUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows: tenantRows } = await pool.query("SELECT db_url FROM tenants WHERE slug = 'cali'");
        const caliDbUrl = tenantRows[0].db_url;

        const caliPool = new Pool({
            connectionString: caliDbUrl,
            ssl: { rejectUnauthorized: false }
        });

        const { rows } = await caliPool.query("SELECT id, name, email FROM agents");
        console.log('Agents in Cali DB:', rows);
        
        const targetId = 'e1bc1d31-7745-4c6e-b373-778deae76fca';
        const found = rows.find(a => a.id === targetId);
        if (found) {
            console.log(`Agent ${targetId} FOUND!`);
        } else {
            console.log(`Agent ${targetId} NOT FOUND in Cali.`);
        }

        await caliPool.end();
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkAgents();
