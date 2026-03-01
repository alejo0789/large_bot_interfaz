
const { Pool } = require('pg');
require('dotenv').config();

const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkCali() {
    const pool = new Pool({
        connectionString: masterUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows } = await pool.query("SELECT * FROM tenants WHERE slug = 'cali'");
        if (rows.length > 0) {
            console.log('Tenant Cali DB URL Info:');
            const url = rows[0].db_url;
            console.log('URL ends with:', url.split('/').pop());
            const dbName = url.split('/').pop().split('?')[0];
            console.log('DB Name:', dbName);

            console.log('Master URL ends with:', masterUrl.split('/').pop());
            const masterDbName = masterUrl.split('/').pop().split('?')[0];
            console.log('Master DB Name:', masterDbName);

            if (dbName === masterDbName) {
                console.log('🚨 ALERT: Cali is pointing to the SAME DATABASE as Master!');
            }
        } else {
            console.log('Tenant Cali not found');
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkCali();
