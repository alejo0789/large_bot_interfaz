const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require',
    ssl: { rejectUnauthorized: false }
});

const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'distribuidores_ventas';

async function enrichNames() {
    console.log('🔍 Buscando conversaciones sin nombre real...');

    // Get contacts where name = phone (i.e., no real name was found)
    const res = await pool.query(`
        SELECT phone FROM conversations 
        WHERE contact_name = phone
        ORDER BY last_message_timestamp DESC NULLS LAST
        LIMIT 200
    `);
    
    console.log(`📋 ${res.rows.length} conversaciones para intentar enriquecer`);
    
    let enriched = 0;
    const BATCH_PHONES = res.rows.map(r => r.phone);

    // Try to get contact info in batches via whatsappNumbers endpoint
    // (to check if it's a valid WA number and get jid)
    const BATCH_SIZE = 20;
    for (let i = 0; i < BATCH_PHONES.length; i += BATCH_SIZE) {
        const batch = BATCH_PHONES.slice(i, i + BATCH_SIZE);
        
        try {
            const url = `${BASE_URL}/chat/whatsappNumbers/${INSTANCE}`;
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ numbers: batch })
            });

            if (!r.ok) {
                console.warn(`⚠️ Batch ${i}-${i+BATCH_SIZE} failed: ${r.status}`);
                continue;
            }

            const data = await r.json();
            if (Array.isArray(data)) {
                for (const contact of data) {
                    if (contact.name && contact.name !== contact.number) {
                        const cleanPhone = (contact.number || '').replace(/\D/g, '');
                        if (cleanPhone) {
                            await pool.query(
                                'UPDATE conversations SET contact_name = $1 WHERE phone = $2 AND contact_name = phone',
                                [contact.name, cleanPhone]
                            );
                            enriched++;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn(`Batch error: ${e.message}`);
        }
        
        console.log(`⏳ Procesados ${Math.min(i + BATCH_SIZE, BATCH_PHONES.length)}/${BATCH_PHONES.length} — Enriquecidos: ${enriched}`);
    }

    // For group IDs (long numbers > 15 digits), mark them as "Grupo"
    const groupRes = await pool.query(`
        UPDATE conversations 
        SET contact_name = 'Grupo ' || LEFT(phone, 8) || '...'
        WHERE contact_name = phone 
        AND LENGTH(phone) > 15
    `);
    console.log(`\n🏷️ ${groupRes.rowCount} grupos marcados con nombre genérico`);

    console.log(`\n✅ Listo. ${enriched} nombres enriquecidos desde Evolution API`);
    await pool.end();
}

enrichNames().catch(e => { console.error(e); pool.end(); });
