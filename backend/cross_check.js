const { Pool } = require('pg');
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";

async function crossCheck() {
    const pool = new Pool({ connectionString: TENANT_DB_URL });
    try {
        console.log("🔍 Iniciando búsqueda cruzada de LIDs y Números Reales...");

        const { rows: allConvs } = await pool.query("SELECT phone, contact_name FROM conversations");

        const realPhones = allConvs.filter(c => c.phone.length <= 13 && c.phone.startsWith('+573'));
        const longLids = allConvs.filter(c => c.phone.length > 13);

        console.log(`📊 Reales: ${realPhones.length}, LIDs: ${longLids.length}`);

        for (const lid of longLids) {
            const digits = lid.phone.replace(/\D/g, '');
            let found = false;

            for (const real of realPhones) {
                const realDigits = real.phone.replace(/\D/g, '').substring(2); // quitamos el 57
                if (digits.includes(realDigits)) {
                    console.log(`✅ MATCH ENCONTRADO!`);
                    console.log(`   LID: ${lid.phone} - "${lid.contact_name}"`);
                    console.log(`   Real: ${real.phone} - "${real.contact_name}"`);
                    console.log(`   Contiene: ${realDigits}`);
                    found = true;
                }
            }

            if (!found) {
                // Try to see if it contains a 10-digit sequence starting with 3
                const match = digits.match(/3\d{9}/);
                if (match) {
                    console.log(`🚩 LID sospechoso (contiene posible número): ${lid.phone} -> +57${match[0]}`);
                }
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
crossCheck();
