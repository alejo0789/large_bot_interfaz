const { Client } = require('pg');

const masterDbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require';
const newToken = 'EAAWV1OTJIB0BS3j0YruOgzJZAGwYgAB5T1EKdQ0rIr1bDSebotPadvmeUyV4sgkQZBPIrCt7WNYXZCsGONqUFdPZBszq3ZAxBAsfZAszVpK9MYHLLTJP5DBuRWVwEmcm8ZBwcGWXZAkWQlXEpERhZBwPE54cpuO9r5HVNcCfWcCbMWFaPmQJ6ZCxShaHDcXYgGkWpoywZDZD';

async function updateToken() {
    const client = new Client({ connectionString: masterDbUrl });
    try {
        await client.connect();
        await client.query(`
            UPDATE tenants 
            SET wa_access_token = $1, updated_at = NOW() 
            WHERE slug = 'sedeminutodios'
        `, [newToken]);
        console.log("TOKEN UPDATED SUCCESSFULLY IN MASTER DB FOR sedeminutodios");
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

updateToken();
