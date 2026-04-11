const { Pool } = require('pg');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require',
    ssl: { rejectUnauthorized: false }
});

const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'distribuidores_ventas';

async function fixLIDs() {
    console.log('🔍 Buscando conversaciones basadas en LIDs...');

    try {
        // Encontrar conversaciones que son LIDs (Tienen @lid o son números largos)
        // Por seguridad, un LID suele tener más de 14 dígitos o terminar en @lid
        let res = await pool.query(`
            SELECT phone, contact_name, ai_enabled, status, lead_intent, 
                   last_message_text, last_message_timestamp
            FROM conversations 
            WHERE phone LIKE '%@lid' OR LENGTH(phone) >= 14
        `);

        // Filter out groups (@g.us)
        const lidsToFix = res.rows.filter(r => !r.phone.includes('@g.us'));

        console.log(`📋 Encontradas ${lidsToFix.length} conversaciones con LID o números >14 (posibles LIDs)`);

        let fixed = 0;

        for (const conv of lidsToFix) {
            const rawPhone = conv.phone;
            const lidQuery = rawPhone.includes('@lid') ? rawPhone : `${rawPhone}@lid`;

            try {
                // Fetch 1 message from this LID to see if it has remoteJidAlt
                const url = `${BASE_URL}/chat/findMessages/${INSTANCE}`;
                const fetchRes = await fetch(url, {
                    method: 'POST',
                    headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ where: { key: { remoteJid: lidQuery } }, limit: 10 })
                });

                if (!fetchRes.ok) {
                    console.warn(`⚠️ Error conectando Evolution para ${rawPhone}: ${fetchRes.status}`);
                    continue;
                }

                const data = await fetchRes.json();
                
                let realPhone = null;

                let messagesArray = [];
                if (Array.isArray(data)) {
                    messagesArray = data;
                } else if (data && data.response && data.response.message && data.response.message.records) {
                    messagesArray = data.response.message.records;
                } else if (data && data.messages && data.messages.records) {
                    messagesArray = data.messages.records;
                }
                
                if (messagesArray.length > 0) {
                    for (const msg of messagesArray) {
                        if (msg.key && msg.key.remoteJidAlt && msg.key.remoteJidAlt.includes('@s.whatsapp.net')) {
                            realPhone = msg.key.remoteJidAlt.split('@')[0];
                            // Clean the phone number (remove + if any)
                            realPhone = realPhone.replace(/\D/g, '');
                            if (realPhone.startsWith('57') && realPhone.length === 12) {
                                realPhone = '+' + realPhone;
                            }
                            break;
                        }
                    }
                }

                if (realPhone && realPhone !== rawPhone) {
                    console.log(`✅ LID ${rawPhone} resuelto a -> ${realPhone}`);
                    
                    try {
                        // Create conversation if not exists
                        await pool.query(`
                            INSERT INTO conversations 
                            (phone, contact_name, ai_enabled, status, lead_intent, last_message_text, last_message_timestamp, updated_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                            ON CONFLICT (phone) DO UPDATE SET
                            last_message_text = EXCLUDED.last_message_text,
                            last_message_timestamp = EXCLUDED.last_message_timestamp
                        `, [realPhone, conv.contact_name, conv.ai_enabled, conv.status, conv.lead_intent, conv.last_message_text, conv.last_message_timestamp]);

                        // Move messages
                        await pool.query('UPDATE messages SET conversation_phone = $1 WHERE conversation_phone = $2', [realPhone, rawPhone]);
                        
                        // Move tags, ignoring duplicates
                        await pool.query(`
                            UPDATE conversation_tags 
                            SET conversation_phone = $1 
                            WHERE conversation_phone = $2 
                            AND NOT EXISTS (
                                SELECT 1 FROM conversation_tags ct2 
                                WHERE ct2.conversation_phone = $1 AND ct2.tag_id = conversation_tags.tag_id
                            )
                        `, [realPhone, rawPhone]);
                        
                        // Delete remaining old tags that couldn't be moved due to uniqueness
                        await pool.query('DELETE FROM conversation_tags WHERE conversation_phone = $1', [rawPhone]);

                        // Delete LID conversation
                        await pool.query('DELETE FROM conversations WHERE phone = $1', [rawPhone]);

                        fixed++;
                    } catch (dbErr) {
                        console.error(`❌ DB Error procesando ${rawPhone}:`, dbErr.message);
                    }
                } else {
                    console.log(`⏭️ No se encontró remoteJidAlt para ${rawPhone}`);
                }
            } catch (err) {
                console.error(`❌ Error procesando ${rawPhone}:`, err.message);
            }
        }

        console.log(`\n🎉 Finalizado! LIDs corregidos: ${fixed}`);
    } catch (e) {
        console.error('Fatal:', e);
    } finally {
        await pool.end();
    }
}

fixLIDs();
