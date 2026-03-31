const { Client } = require('pg');

async function main() {
    const tenantUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/producto_clientes_finales_db?sslmode=require&channel_binding=require';
    const client = new Client({ connectionString: tenantUrl });
    
    try {
        await client.connect();
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        
        const sd = start.toISOString();
        const ed = end.toISOString();

        console.log("Testing with ISO strings:");
        console.log("SD:", sd);
        console.log("ED:", ed);
        
        const q1 = "SELECT COUNT(*) as count FROM messages WHERE sender NOT IN ('agent', 'me', 'system', 'bot', 'ai') AND timestamp::date >= $1 AND timestamp::date <= $2";
        const result = await client.query(q1, [sd, ed]);
        console.log(`With ISO string params, count:`, result.rows[0].count);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main();
