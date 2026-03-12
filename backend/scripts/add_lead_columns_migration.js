require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const masterPool = new Pool({
    connectionString: process.env.MASTER_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    console.log('🚀 Iniciando migración para agregar lead_intent y lead_time...');
    
    // 1. Aplicar a la base de datos Maestra (por si hay conversaciones allí o plantillas)
    await applyToDatabase(masterPool, 'Master');

    // 2. Buscar todas las sedes activas
    const client = await masterPool.connect();
    let tenants = [];
    try {
        const { rows } = await client.query("SELECT slug, db_url FROM tenants");
        tenants = rows;
    } catch (err) {
        console.error('❌ Error obteniendo sedes:', err.message);
    } finally {
        client.release();
    }

    // 3. Aplicar a cada sede
    for (const tenant of tenants) {
        if (!tenant.db_url) continue;

        console.log(`\n--- Procesando sede: ${tenant.slug} ---`);
        const isLocal = tenant.db_url.includes('localhost') || tenant.db_url.includes('127.0.0.1') || tenant.db_url.includes('database');
        
        const tenantPool = new Pool({
            connectionString: tenant.db_url,
            ssl: isLocal ? false : { rejectUnauthorized: false }
        });

        await applyToDatabase(tenantPool, `Sede: ${tenant.slug}`);
        await tenantPool.end();
    }

    console.log('✅ Migración completada en todas las bases de datos.');
    await masterPool.end();
}

async function applyToDatabase(pool, name) {
    console.log(`\nMogrando base de datos [${name}]...`);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Agregar columna lead_intent
        await client.query(`
            ALTER TABLE conversations 
            ADD COLUMN IF NOT EXISTS lead_intent VARCHAR(50) DEFAULT NULL;
        `);

        // Agregar columna lead_time
        await client.query(`
            ALTER TABLE conversations 
            ADD COLUMN IF NOT EXISTS lead_time VARCHAR(50) DEFAULT NULL;
        `);

        await client.query('COMMIT');
        console.log(`✅ Columnas agregadas a [${name}]`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Error al migrar [${name}]:`, err.message);
    } finally {
        client.release();
    }
}

runMigration();
