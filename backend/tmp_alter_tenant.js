const { Client } = require('pg');

async function main() {
    const tenantUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/producto_clientes_finales_db?sslmode=require&channel_binding=require';
    const client = new Client({ connectionString: tenantUrl });
    
    try {
        await client.connect();
        
        let res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'conversation_tags'");
        console.log("Columns before:", res.rows);
        
        // Add the missing column
        console.log("Adding column assigned_by to conversation_tags...");
        await client.query("ALTER TABLE conversation_tags ADD COLUMN IF NOT EXISTS assigned_by VARCHAR(255)");
        
        res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'conversation_tags'");
        console.log("Columns after:", res.rows);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.end();
    }
}

main();
