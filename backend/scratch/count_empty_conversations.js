const { Pool } = require('pg');

const DATABASE_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require&channel_binding=require";

async function run() {
    console.log("🔍 Checking for empty conversations (zero messages)...");
    
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Identification
        const emptyConvsQuery = `
            SELECT phone, contact_name, created_at 
            FROM conversations c
            WHERE NOT EXISTS (
                SELECT 1 FROM messages m WHERE m.conversation_phone = c.phone
            )
        `;
        
        const { rows: emptyConvs } = await pool.query(emptyConvsQuery);
        
        console.log("\n--------------------------------------------------");
        console.log(`📊 TOTAL ENCONTRADAS: ${emptyConvs.length}`);
        console.log("--------------------------------------------------\n");

        if (emptyConvs.length > 0) {
            console.log("Muestra de las primeras 10:");
            emptyConvs.slice(0, 10).forEach(c => {
                console.log(`- ${c.phone} (${c.contact_name || 'Sin nombre'}) | Creada: ${c.created_at}`);
            });
        } else {
            console.log("✅ No se encontraron conversaciones vacías.");
        }

    } catch (err) {
        console.error("❌ Error al consultar:", err);
    } finally {
        await pool.end();
    }
}

run();
