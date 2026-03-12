const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function check() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        const phone = '+573025449563';
        console.log(`🔍 Buscando a Katherine Leon (${phone}):`);
        const { rows } = await pool.query(`
            SELECT phone, contact_name FROM conversations WHERE phone = $1
        `, [phone]);
        console.table(rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
