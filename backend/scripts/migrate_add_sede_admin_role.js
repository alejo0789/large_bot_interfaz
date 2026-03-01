/**
 * Migration: Add SEDE_ADMIN value to user_role enum
 * 
 * The DB uses a native PostgreSQL enum type (user_role).
 * This script safely adds 'SEDE_ADMIN' if it doesn't already exist.
 * 
 * Usage:
 *   node scripts/migrate_add_sede_admin_role.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const masterPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'root',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'chatbot_master',
});

async function migrate() {
    const client = await masterPool.connect();
    try {
        console.log('🔄 Starting migration: add SEDE_ADMIN to user_role enum...');

        // Check if SEDE_ADMIN already exists in the enum
        const { rows: existing } = await client.query(`
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'SEDE_ADMIN' 
              AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
        `);

        if (existing.length > 0) {
            console.log('  ✅ SEDE_ADMIN already exists in user_role enum — skipping.');
        } else {
            // ALTER TYPE must run outside a transaction block
            await client.query(`ALTER TYPE user_role ADD VALUE 'SEDE_ADMIN'`);
            console.log('  ✅ Added SEDE_ADMIN to user_role enum');
        }

        // Ensure last_login column exists
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ`);
        console.log('  ✅ last_login column ensured');

        console.log('\n✅ Migration complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await masterPool.end();
    }
}

migrate();
