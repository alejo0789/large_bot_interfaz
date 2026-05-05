require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const masterPool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function inspectMaster() {
    try {
        console.log('--- Tables ---');
        const tables = await masterPool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log(tables.rows.map(r => r.table_name));

        console.log('\n--- User paula.arjona ---');
        const user = await masterPool.query("SELECT * FROM users WHERE username = 'paula.arjona'");
        console.log(user.rows);

        if (user.rows.length > 0) {
            const userId = user.rows[0].id;
            console.log(`\n--- Tenant mappings for user ${userId} ---`);
            // Try to find a junction table, common names: user_tenants, user_sedes, etc.
            // Or maybe a column 'tenants' in users?
            
            const columns = await masterPool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
            console.log('User columns:', columns.rows.map(r => r.column_name));
            
            // Check for user_tenants table
            const userTenants = await masterPool.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'user_tenants'");
            if (userTenants.rows.length > 0) {
                const mappings = await masterPool.query("SELECT * FROM user_tenants WHERE user_id = $1", [userId]);
                console.log('User-Tenant mappings:', mappings.rows);
            }
        }

        console.log('\n--- Target Tenants ---');
        const targetTenants = await masterPool.query("SELECT id, name, slug FROM tenants WHERE slug IN ('villavicencio', 'bogotapaula', 'bucaramangapaula')");
        console.log(targetTenants.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await masterPool.end();
    }
}

inspectMaster();
