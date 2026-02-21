require('dotenv').config();
const { pool } = require('./src/config/database');

async function check() {
    try {
        const { rows } = await pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE column_name = 'agent_id' AND table_name IN ('messages', 'conversations');");
        console.log("Column Data Types:", rows);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}
check();
