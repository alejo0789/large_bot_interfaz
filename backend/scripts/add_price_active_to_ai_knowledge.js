/**
 * Migración: añadir columnas price y active a ai_knowledge
 * Ejecutar con: node scripts/add_price_active_to_ai_knowledge.js
 */
require('dotenv').config();
const { Pool } = require('pg');

async function migratePool(pool, label) {
    const client = await pool.connect();
    try {
        // Añadir price si no existe
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='ai_knowledge' AND column_name='price'
                ) THEN
                    ALTER TABLE ai_knowledge ADD COLUMN price NUMERIC(12,2);
                END IF;
            END $$;
        `);
        // Añadir active si no existe
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='ai_knowledge' AND column_name='active'
                ) THEN
                    ALTER TABLE ai_knowledge ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
                END IF;
            END $$;
        `);
        console.log(`✅ [${label}] Migración completada`);
    } catch (err) {
        console.error(`❌ [${label}] Error:`, err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

async function main() {
    const seen = new Set();

    const toMigrate = [];
    if (process.env.DATABASE_URL) toMigrate.push({ url: process.env.DATABASE_URL, label: 'DATABASE_URL' });
    if (process.env.MASTER_DATABASE_URL && process.env.MASTER_DATABASE_URL !== process.env.DATABASE_URL) {
        toMigrate.push({ url: process.env.MASTER_DATABASE_URL, label: 'MASTER_DATABASE_URL' });
    }

    // Buscar tenants en MASTER_DATABASE_URL
    const masterUrl = process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL;
    if (masterUrl) {
        const mPool = new Pool({ connectionString: masterUrl });
        const client = await mPool.connect();
        try {
            const res = await client.query('SELECT slug, db_url FROM tenants WHERE db_url IS NOT NULL');
            for (const t of res.rows) {
                if (t.db_url) toMigrate.push({ url: t.db_url, label: `tenant:${t.slug}` });
            }
        } catch (e) {
            console.warn('⚠️ No se encontró tabla tenants:', e.message);
        } finally {
            client.release();
            await mPool.end();
        }
    }

    // Migrar cada BD (sin duplicados)
    for (const { url, label } of toMigrate) {
        if (seen.has(url)) { console.log(`⏭️  [${label}] ya migrada, omitiendo`); continue; }
        seen.add(url);
        const pool = new Pool({ connectionString: url });
        await migratePool(pool, label);
    }

    console.log('🎉 Todas las migraciones completadas');
}

main().catch(console.error);
