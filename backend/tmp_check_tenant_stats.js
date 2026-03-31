const { Client } = require('pg');

async function main() {
    const tenantUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/producto_clientes_finales_db?sslmode=require&channel_binding=require';
    const client = new Client({ connectionString: tenantUrl });
    
    try {
        await client.connect();
        
        console.log("Connected. Checking stats...");
        
        // Let's check total messages in the database
        const totalMsg = await client.query("SELECT COUNT(*) FROM messages");
        console.log("Total messages in DB:", totalMsg.rows[0].count);
        
        // Let's check max timestamp
        const maxTs = await client.query("SELECT MAX(timestamp) FROM messages");
        console.log("Max timestamp:", maxTs.rows[0].max);

        // check types of timestamp
        const tsTypes = await client.query("SELECT pg_typeof(timestamp) FROM messages LIMIT 1");
        if(tsTypes.rows.length>0) {
            console.log("Timestamp column type:", tsTypes.rows[0].pg_typeof);
        } else {
            console.log("No messages to check type.");
        }

        // test the exact dashboard query
        const received = await client.query("SELECT COUNT(*) as count FROM messages WHERE sender NOT IN ('agent', 'me', 'system') AND timestamp >= CURRENT_DATE");
        console.log("Received today:", received.rows[0].count);

        const ai = await client.query("SELECT COUNT(*) as count FROM messages WHERE sender IN ('bot', 'ai') AND timestamp >= CURRENT_DATE");
        console.log("AI today:", ai.rows[0].count);
        
        // test how many for current date manually
        const tzInfo = await client.query("SHOW timezone");
        console.log("DB Timezone:", tzInfo.rows[0].TimeZone);
        
        const manualCurrentDate = await client.query("SELECT CURRENT_DATE as cd, CURRENT_TIMESTAMP as ct");
        console.log("DB CURRENT_DATE:", manualCurrentDate.rows[0].cd);

        const latestMsgs = await client.query("SELECT timestamp, sender FROM messages ORDER BY timestamp DESC LIMIT 3");
        console.log("Latest messages details:", latestMsgs.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main();
