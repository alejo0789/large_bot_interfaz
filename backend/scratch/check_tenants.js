require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const masterPool = new Pool({
    connectionString: process.env.MASTER_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkTenants() {
    try {
        const { rows } = await masterPool.query('SELECT id, name, slug, evolution_instance, is_active FROM tenants ORDER BY name');
        console.log('=== Current Tenants ===');
        rows.forEach(r => console.log(`  [${r.slug}] ${r.name} | instance: ${r.evolution_instance || 'N/A'} | active: ${r.is_active}`));
        
        // Check if villavicencio exists
        const villaExists = rows.some(r => r.slug === 'villavicencio');
        console.log(`\nVillavicencio registered: ${villaExists ? 'YES' : 'NO'}`);

        // Show tenants table schema
        const { rows: cols } = await masterPool.query(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' ORDER BY ordinal_position"
        );
        console.log('\n=== Tenants table columns ===');
        cols.forEach(c => console.log(`  ${c.column_name} | ${c.data_type}`));
        
    } catch (err) {
        console.error('ERR:', err.message);
    } finally {
        await masterPool.end();
    }
}

checkTenants();
