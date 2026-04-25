const { Pool } = require('pg');
const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';

async function checkSchema() {
    const pool = new Pool({
        connectionString: masterUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows: tenantRows } = await pool.query("SELECT db_url FROM tenants WHERE slug = 'cali'");
        const caliDbUrl = tenantRows[0].db_url;

        const caliPool = new Pool({
            connectionString: caliDbUrl,
            ssl: { rejectUnauthorized: false }
        });

        const { rows } = await caliPool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'messages'
        `);
        console.log('Messages table schema in Cali:', rows);

        const { rows: constraints } = await caliPool.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'messages'::regclass
        `);
        console.log('Messages constraints in Cali:', constraints);

        await caliPool.end();
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkSchema();
