const { Client } = require('pg');

async function main() {
    const masterDbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';
    const client = new Client({ connectionString: masterDbUrl });
    
    try {
        await client.connect();
        
        let res = await client.query("SELECT * FROM tenants WHERE slug = 'productos_clientes_finales'");
        if (res.rows.length === 0) {
            console.log("No tenant found by slug. Checking generic names.");
            res = await client.query("SELECT * FROM tenants");
        }
        
        console.log("Tenants found:", res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main();
