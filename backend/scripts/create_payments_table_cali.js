/**
 * Migration: Create `payments` table in Cali tenant DB (chatbot_db)
 * NOTE: Cali's conversations table uses 'phone' (varchar) as PK, not an integer id.
 * Run: node scripts/create_payments_table_cali.js
 */
const { Client } = require('pg');

const CALI_DB_URL = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require';

const sql = `
CREATE TABLE IF NOT EXISTS payments (
    id              SERIAL PRIMARY KEY,

    -- Datos extraídos del email de notificación bancaria (por n8n)
    reference       VARCHAR(100),
    amount          NUMERIC(15, 2),
    bank            VARCHAR(100),
    payer_name      VARCHAR(200),
    payer_account   VARCHAR(50),
    payment_date    TIMESTAMP,
    email_subject   TEXT,
    raw_email       TEXT,

    -- Estado del pago
    status          VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- Valores: pending | verified | rejected | duplicate

    -- Datos de verificación (cuando el cliente envía el comprobante)
    verified_at     TIMESTAMP,
    verified_by     VARCHAR(100),
    -- FK a conversations usando phone (PK de conversations en este tenant)
    conversation_phone VARCHAR(50) REFERENCES conversations(phone) ON DELETE SET NULL,
    notes           TEXT,

    -- Auditoría
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índice único para evitar duplicados del mismo pago (misma referencia + misma fecha)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_ref_date
    ON payments(reference, payment_date)
    WHERE reference IS NOT NULL;

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_payments_status  ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_date    ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_phone   ON payments(conversation_phone);
CREATE INDEX IF NOT EXISTS idx_payments_amount  ON payments(amount);
CREATE INDEX IF NOT EXISTS idx_payments_bank    ON payments(bank);
`;

async function run() {
    const client = new Client(CALI_DB_URL);
    try {
        await client.connect();
        console.log('✅ Conectado a chatbot_db (Cali)');

        await client.query(sql);
        console.log('✅ Tabla payments creada / ya existía correctamente');

        // Verify columns
        const { rows: cols } = await client.query(`
            SELECT column_name, data_type, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'payments'
            ORDER BY ordinal_position
        `);

        console.log('\n📋 Estructura de la tabla payments:');
        cols.forEach(c => {
            console.log(`  - ${c.column_name.padEnd(25)} ${c.data_type.padEnd(25)} default=${(c.column_default || 'null').padEnd(15)} nullable=${c.is_nullable}`);
        });

        // Verify indexes
        const { rows: indexes } = await client.query(`
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'payments'
            ORDER BY indexname
        `);
        console.log('\n🗂 Índices:');
        indexes.forEach(i => console.log(`  - ${i.indexname}`));

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
