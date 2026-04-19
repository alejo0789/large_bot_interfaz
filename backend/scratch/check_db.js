const { pool } = require('./src/config/database');
const { tenantContext } = require('./src/utils/tenantContext');

async function checkColumns() {
    try {
        // We need a tenant context to use the pool if it depends on it, but here it seems global or uses defaults
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'messages' 
            AND column_name LIKE 'reply_to%';
        `);
        console.log('Columns found:', res.rows);
    } catch (err) {
        console.error('Error checking columns:', err.message);
    } finally {
        process.exit();
    }
}

checkColumns();
