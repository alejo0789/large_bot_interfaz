const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require' });

async function check() {
    try {
        const res1 = await pool.query("SELECT count(*) FROM conversations");
        console.log('Conversations count:', res1.rows[0].count);
        const res2 = await pool.query("SELECT count(*) FROM messages");
        console.log('Messages count:', res2.rows[0].count);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
