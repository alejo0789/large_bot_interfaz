const { Pool } = require('pg');

async function migratePool(pool, label) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS payments (
            id SERIAL PRIMARY KEY,
            reference VARCHAR(100),
            amount NUMERIC(15, 2),
            bank VARCHAR(100),
            payer_name VARCHAR(200),
            payer_account VARCHAR(50),
            payment_date TIMESTAMP,
            email_subject TEXT,
            raw_email TEXT,
            direction VARCHAR(20) NOT NULL DEFAULT 'incoming',
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            verified_at TIMESTAMP,
            verified_by VARCHAR(100),
            conversation_phone VARCHAR(50) REFERENCES conversations(phone) ON DELETE SET NULL,
            notes TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS direction VARCHAR(20) NOT NULL DEFAULT 'incoming';

        UPDATE payments
        SET direction = 'incoming'
        WHERE direction IS NULL OR direction NOT IN ('incoming', 'outgoing');

        CREATE INDEX IF NOT EXISTS idx_payments_direction ON payments(direction);
    `);
    console.log(`OK ${label}`);
}

async function main() {
    const masterUrl = process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL;
    if (!masterUrl) throw new Error('Falta MASTER_DATABASE_URL o DATABASE_URL');

    const master = new Pool({ connectionString: masterUrl, ssl: { rejectUnauthorized: false } });
    const tenants = (await master.query(
        'SELECT slug, db_url FROM tenants WHERE is_active = TRUE AND db_url IS NOT NULL ORDER BY slug'
    )).rows;

    for (const tenant of tenants) {
        const pool = new Pool({
            connectionString: tenant.db_url,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000
        });
        try {
            await migratePool(pool, tenant.slug);
        } catch (error) {
            console.error(`ERROR ${tenant.slug}: ${error.message}`);
        } finally {
            await pool.end();
        }
    }

    await master.end();
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});