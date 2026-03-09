const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function check() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("🔍 Buscando fragmentos de LIDs en números reales...");

        const targets = ['56036438372368', '14306653515995', '110664244809851', '76549269225537'];

        for (const t of targets) {
            console.log(`\nObjetivo: ${t}`);
            // Buscamos si algún número de 10 dígitos está contenido en el LID
            const { rows } = await pool.query(`
                SELECT phone, contact_name 
                FROM conversations 
                WHERE $1 LIKE '%' || substring(phone from 4) || '%'
                AND length(phone) <= 13
            `, [t]);
            console.table(rows);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
