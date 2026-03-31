const { Client } = require('pg');

async function main() {
    const tenantUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/producto_clientes_finales_db?sslmode=require&channel_binding=require';
    const client = new Client({ connectionString: tenantUrl });
    
    try {
        await client.connect();
        const dateStr = '2026-03-25'; // what frontend likely sends
        const query = "SELECT COUNT(*) as count FROM messages WHERE sender NOT IN ('agent', 'me', 'system', 'bot', 'ai') AND timestamp::date = $1";
        const result = await client.query(query, [dateStr]);
        console.log(`With dateFilterMsg="timestamp::date = $1", count:`, result.rows[0].count);

        const ai = await client.query("SELECT COUNT(*) as count FROM messages WHERE sender IN ('bot', 'ai') AND timestamp::date = $1", [dateStr]);
        console.log(`AI With dateFilterMsg="timestamp::date = $1", count:`, ai.rows[0].count);

        const current_date_count = await client.query("SELECT COUNT(*) as count FROM messages WHERE sender NOT IN ('agent', 'me', 'system', 'bot', 'ai') AND timestamp >= CURRENT_DATE");
        console.log(`With dateFilterMsg="timestamp >= CURRENT_DATE", count:`, current_date_count.rows[0].count);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main();
