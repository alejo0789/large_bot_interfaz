require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');

const run = async () => {
    try {
        if (!process.env.DATABASE_URL) {
            console.error('❌ DATABASE_URL is not defined in .env');
            process.exit(1);
        }

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL.includes('railway') || process.env.DATABASE_URL.includes('aws')
                ? { rejectUnauthorized: false }
                : false
        });

        // Date cutoff: 2026-02-15 00:00:00
        const cutoffDate = '2026-02-15 00:00:00';

        console.log(`Connecting to database...`);
        console.log(`Updating conversations with unread messages before ${cutoffDate}...`);

        // Use last_message_timestamp instead of last_message_time
        const result = await pool.query(`
            UPDATE conversations 
            SET unread_count = 0 
            WHERE last_message_timestamp < $1 
            AND unread_count > 0;
        `, [cutoffDate]);

        console.log(`✅ Success! Updated ${result.rowCount} conversations.`);

        await pool.end();
    } catch (error) {
        console.error('❌ Error executing update:', error);
    }
};

run();
