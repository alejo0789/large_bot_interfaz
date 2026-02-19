const { pool } = require('../src/config/database');

async function runCallback() {
    try {
        console.log('🔄 Checking messages table for reactions column...');

        // Check if column exists
        const checkRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='messages' AND column_name='reactions';
    `);

        if (checkRes.rows.length === 0) {
            console.log('⚠️ Column reactions does not exist. Adding it...');
            await pool.query(`
        ALTER TABLE messages 
        ADD COLUMN reactions JSONB DEFAULT '[]'::jsonb;
      `);
            console.log('✅ Column reactions added successfully (JSONB).');
        } else {
            console.log('✅ Column reactions already exists.');
        }

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        pool.end();
    }
}

// Load env vars if running directly
if (require.main === module) {
    require('dotenv').config({ path: '../.env' }); // Adjust path to .env if needed
    runCallback();
} else {
    module.exports = runCallback;
}
