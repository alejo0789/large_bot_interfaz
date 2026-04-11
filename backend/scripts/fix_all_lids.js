const { Pool } = require('pg');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

const masterUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_master?sslmode=require&channel_binding=require';
const BASE_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-8e62.up.railway.app';

async function fixLidsAllTenants() {
    const masterPool = new Pool({
        connectionString: masterUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows: tenants } = await masterPool.query('SELECT * FROM tenants');
        console.log(`📋 Encontrados ${tenants.length} tenants en la BD Master.`);

        for (const tenant of tenants) {
            console.log(`\n======================================================`);
            console.log(`🔍 Procesando Sede: ${tenant.name} (${tenant.slug})`);
            console.log(`======================================================`);
            
            const tenantPool = new Pool({
                connectionString: tenant.db_url,
                ssl: { rejectUnauthorized: false }
            });

            // Extraer las credenciales de Evolution de este tenant en especifico
            let apiKey = process.env.EVOLUTION_API_KEY || 'hash_12345';
            let instance = process.env.EVOLUTION_INSTANCE || tenant.slug;

            if (tenant.evolution_api_key) apiKey = tenant.evolution_api_key;
            if (tenant.evolution_instance) instance = tenant.evolution_instance;

            try {
                console.log(`📡 Fetching mensajes de Evolution para la instancia: ${instance}...`);
                let allRecords = [];
                let page = 1;
                const totalToFetch = 3000;
                const perPage = 100;
                
                while (allRecords.length < totalToFetch) {
                    const url = `${BASE_URL}/chat/findMessages/${instance}`;
                    const fetchRes = await fetch(url, {
                        method: 'POST',
                        headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ page: page, limit: perPage })
                    });

                    if (!fetchRes.ok) {
                        console.log(`⚠️ Evolution API error (${fetchRes.status}) para ${instance}. No se pudo descargar info.`);
                        break;
                    }
                    const data = await fetchRes.json();
                    const records = Array.isArray(data) ? data : (data?.response?.message?.records || data?.messages || null);
                    
                    if (!records || !Array.isArray(records) || records.length === 0) {
                        console.log(`✅ Fin de historiales en page ${page}`);
                        break;
                    }
                    
                    allRecords = allRecords.concat(records);
                    page++;
                }

                if (allRecords.length === 0) {
                    console.log(`⏭️ No hay registros para resolver en esta sede.`);
                    continue;
                }

                console.log(`📊 Total mensajes descargados: ${allRecords.length}`);
                
                const lidToPhoneMap = {};
                for (const msg of allRecords) {
                    if (msg.key) {
                        const j1 = msg.key.remoteJid;
                        const j2 = msg.key.remoteJidAlt;
                        const p1 = msg.key.participant;
                        const p2 = msg.key.participantAlt;
                        
                        const processPair = (jid1, jid2) => {
                            if (!jid1 || !jid2) return;
                            jid1 = jid1.split('@')[0];
                            jid2 = jid2.split('@')[0];
                            const isJid1Lid = jid1.length > 13 || String(jid1).includes('@lid');
                            if (isJid1Lid && !String(jid2).includes('@lid') && jid2.length < 16) {
                                lidToPhoneMap[jid1] = jid2;
                            } else if (!isJid1Lid && jid1.length < 16 && (jid2.length > 13 || String(jid2).includes('@lid'))) {
                                lidToPhoneMap[jid2] = jid1;
                            }
                        };
                        
                        processPair(j1, j2);
                        processPair(p1, p2);
                    }
                }

                const lidsFound = Object.keys(lidToPhoneMap);
                console.log(`🗺️ Encontrados ${lidsFound.length} mapéos únicos de LIDs a teléfonos reales.`);
                
                if (lidsFound.length === 0) continue;

                let fixedCount = 0;
                for (const rawLid of lidsFound) {
                    let realPhone = lidToPhoneMap[rawLid];
                    realPhone = realPhone.replace(/\D/g, '');
                    if (realPhone.startsWith('57') && realPhone.length === 12) realPhone = '+' + realPhone;
                    
                    const checkLid = await tenantPool.query('SELECT * FROM conversations WHERE phone = $1 OR phone = $2', [rawLid, `${rawLid}@lid`]);
                    
                    if (checkLid.rows.length > 0) {
                        const conv = checkLid.rows[0];
                        const actualLidPhone = conv.phone;
                        console.log(`   🛠️  Resolviendo en DB: LID ${actualLidPhone} -> ${realPhone}`);
                        
                        try {
                            await tenantPool.query(`
                                INSERT INTO conversations 
                                (phone, contact_name, ai_enabled, status, lead_intent, last_message_text, last_message_timestamp, updated_at)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                                ON CONFLICT (phone) DO UPDATE SET
                                last_message_text = EXCLUDED.last_message_text,
                                last_message_timestamp = EXCLUDED.last_message_timestamp
                            `, [realPhone, conv.contact_name, conv.ai_enabled, conv.status, conv.lead_intent, conv.last_message_text, conv.last_message_timestamp]);

                            await tenantPool.query('UPDATE messages SET conversation_phone = $1 WHERE conversation_phone = $2', [realPhone, actualLidPhone]);
                            await tenantPool.query('UPDATE conversation_tags SET conversation_phone = $1 WHERE conversation_phone = $2 ON CONFLICT DO NOTHING', [realPhone, actualLidPhone]);
                            await tenantPool.query('DELETE FROM conversation_tags WHERE conversation_phone = $1', [actualLidPhone]);
                            await tenantPool.query('DELETE FROM conversations WHERE phone = $1', [actualLidPhone]);
                            
                            fixedCount++;
                        } catch (err) {
                            console.error(`   ❌ Error moviendo DB info para ${rawLid}:`, err.message);
                        }
                    }
                }
                console.log(`🎉 Finalizado Sede ${tenant.slug}. LIDs corruptos reparados: ${fixedCount}`);
                
            } catch (tenantErr) {
                console.error(`❌ Falló la conexión con tenant ${tenant.slug}:`, tenantErr);
            } finally {
                await tenantPool.end();
            }
        }
    } catch (globalErr) {
        console.error('Error global:', globalErr);
    } finally {
        await masterPool.end();
        console.log('\n✅ Script completado. Por favor reinicia tu servidor si es necesario.');
    }
}

fixLidsAllTenants();
