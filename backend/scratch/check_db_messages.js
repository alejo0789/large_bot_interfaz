const { Pool } = require('pg');
const dbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require';

async function checkDb() {
    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    const { rows } = await pool.query('SELECT text_content, timestamp FROM messages WHERE conversation_phone LIKE $1 ORDER BY timestamp DESC LIMIT 10', ['%573114683297%']);
    console.log(JSON.stringify(rows, null, 2));
    await pool.end();
}
checkDb();
