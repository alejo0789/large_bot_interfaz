const { Pool } = require('pg');
const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function deleteGhostCali() {
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

        // Delete the ghost conversation with the + prefix and 18 digits
        const deleteRes = await caliPool.query("DELETE FROM conversations WHERE phone = '+120363422096835125'");
        console.log(`Deleted ${deleteRes.rowCount} ghost conversations in Cali.`);

        await caliPool.end();
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

deleteGhostCali();
