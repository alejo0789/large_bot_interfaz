const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function fixNames() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("🛠️ Limpiando nombres de contactos que son LIDs o IDs largos...");

        // Buscamos conversaciones donde el nombre es raro o muy largo
        const { rows } = await pool.query(`
            SELECT phone, contact_name 
            FROM conversations 
            WHERE length(contact_name) > 13 
            OR contact_name ~ '^[0-9+]+$'
        `);

        console.log(`Analisando ${rows.length} posibles casos.`);

        for (const row of rows) {
            // Si el nombre es solo números/signos o es un LID largo
            if (/^[0-9+]+$/.test(row.contact_name) || row.contact_name.length > 15 || row.contact_name.includes('@')) {
                const newName = row.phone; // Usar el teléfono limpio como nombre
                if (row.contact_name !== newName) {
                    console.log(`   📝 Renombrando: "${row.contact_name}" -> "${newName}"`);
                    await pool.query("UPDATE conversations SET contact_name = $1 WHERE phone = $2", [newName, row.phone]);
                }
            }
        }

        console.log("\n✨ Limpieza de nombres terminada.");
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

fixNames();
