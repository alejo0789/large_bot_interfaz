const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require', ssl: { rejectUnauthorized: false } });

async function checkLen() {
    try {
        const res = await pool.query("SELECT phone, contact_name, LENGTH(phone) as len FROM conversations WHERE contact_name = phone ORDER BY len DESC LIMIT 15");
        res.rows.forEach(x => console.log(x.len, '|', x.phone, '|', x.contact_name));
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
    }
}
checkLen();
