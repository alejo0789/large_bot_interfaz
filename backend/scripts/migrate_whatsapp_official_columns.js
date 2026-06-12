/**
 * Migración: Agregar columnas de API Oficial de WhatsApp a la tabla tenants
 * 
 * Ejecutar con: node backend/scripts/migrate_whatsapp_official_columns.js
 * 
 * Columnas agregadas:
 *   - whatsapp_provider: 'evolution' (default) | 'official'
 *   - wa_phone_number_id: ID del número en Meta for Developers
 *   - wa_access_token: Token de acceso permanente de Meta
 *   - wa_verify_token: Token para verificar el webhook con Meta
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const masterUrl = process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL;

if (!masterUrl) {
    console.error('❌ No MASTER_DATABASE_URL or DATABASE_URL found in .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString: masterUrl,
    ssl: masterUrl.includes('localhost') || masterUrl.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting migration: WhatsApp Official API columns\n');

        await client.query('BEGIN');

        // 1. whatsapp_provider
        const col1 = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'tenants' AND column_name = 'whatsapp_provider'
        `);
        if (col1.rowCount === 0) {
            await client.query(`
                ALTER TABLE tenants
                ADD COLUMN whatsapp_provider VARCHAR(20) NOT NULL DEFAULT 'evolution'
                CHECK (whatsapp_provider IN ('evolution', 'official'))
            `);
            console.log("✅ Added column: whatsapp_provider (default: 'evolution')");
        } else {
            console.log("⏭️  Column whatsapp_provider already exists — skipping");
        }

        // 2. wa_phone_number_id
        const col2 = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'tenants' AND column_name = 'wa_phone_number_id'
        `);
        if (col2.rowCount === 0) {
            await client.query(`
                ALTER TABLE tenants
                ADD COLUMN wa_phone_number_id VARCHAR(50)
            `);
            console.log("✅ Added column: wa_phone_number_id");
        } else {
            console.log("⏭️  Column wa_phone_number_id already exists — skipping");
        }

        // 3. wa_access_token
        const col3 = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'tenants' AND column_name = 'wa_access_token'
        `);
        if (col3.rowCount === 0) {
            await client.query(`
                ALTER TABLE tenants
                ADD COLUMN wa_access_token TEXT
            `);
            console.log("✅ Added column: wa_access_token");
        } else {
            console.log("⏭️  Column wa_access_token already exists — skipping");
        }

        // 4. wa_verify_token
        const col4 = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'tenants' AND column_name = 'wa_verify_token'
        `);
        if (col4.rowCount === 0) {
            await client.query(`
                ALTER TABLE tenants
                ADD COLUMN wa_verify_token VARCHAR(100)
            `);
            console.log("✅ Added column: wa_verify_token");
        } else {
            console.log("⏭️  Column wa_verify_token already exists — skipping");
        }

        await client.query('COMMIT');

        console.log('\n✅ Migration completed successfully!\n');

        // Show current tenant config
        const result = await client.query(`
            SELECT slug, name, whatsapp_provider,
                   wa_phone_number_id IS NOT NULL as has_phone_number_id,
                   wa_access_token IS NOT NULL as has_access_token,
                   wa_verify_token IS NOT NULL as has_verify_token
            FROM tenants
            ORDER BY name
        `);

        console.log('📋 Current tenant WhatsApp configuration:');
        console.table(result.rows);

        console.log('\n💡 To configure a tenant for the Official API, run:');
        console.log(`   UPDATE tenants SET`);
        console.log(`     whatsapp_provider = 'official',`);
        console.log(`     wa_phone_number_id = 'YOUR_PHONE_NUMBER_ID',`);
        console.log(`     wa_access_token = 'YOUR_ACCESS_TOKEN',`);
        console.log(`     wa_verify_token = 'YOUR_CUSTOM_VERIFY_TOKEN'`);
        console.log(`   WHERE slug = 'YOUR_TENANT_SLUG';\n`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch(() => process.exit(1));
