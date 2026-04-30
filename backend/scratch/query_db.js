const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require';

async function test() {
    const client = new Client({ connectionString });
    await client.connect();
    
    // Look for recent group messages in the specific group '120363404174391486@g.us'
    const res = await client.query(`
        SELECT id, text_content, media_type, media_url, timestamp, whatsapp_id 
        FROM messages 
        WHERE conversation_phone = '120363404174391486@g.us' 
        ORDER BY timestamp DESC 
        LIMIT 20
    `);
    
    console.log("Recent messages from grupo guias interrapidismo:");
    console.table(res.rows);

    await client.end();
}

test().catch(console.error);
