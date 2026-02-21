require('dotenv').config();
const { pool } = require('./src/config/database');

async function fixColumn() {
    try {
        console.log("Checking structure...");
        // 1. Change the column type from integer to varchar
        // Use USING expression to convert existing data if necessary
        await pool.query(`
            ALTER TABLE messages 
            ALTER COLUMN agent_id TYPE VARCHAR(100) 
            USING agent_id::varchar;
        `);
        console.log("✅ Successfully converted agent_id in messages to VARCHAR");
    } catch (err) {
        console.error("❌ Error altering column:", err);
    } finally {
        pool.end();
    }
}

fixColumn();
