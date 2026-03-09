const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function check() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("📊 Estado de las conversaciones en sedeminutodios:");
        const { rows } = await pool.query(`
            SELECT phone, contact_name 
            FROM conversations 
            ORDER BY updated_at DESC 
            LIMIT 30
        `);
        console.table(rows);

        const { rows: totals } = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE length(phone) > 13) as long_lids,
                COUNT(*) FILTER (WHERE phone LIKE '+573%') as colombia
            FROM conversations
        `);
        console.log("\nTotales:");
        console.table(totals);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
