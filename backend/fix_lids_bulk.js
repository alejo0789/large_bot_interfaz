const { Pool } = require('pg');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require',
    ssl: { rejectUnauthorized: false }
});

const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'distribuidores_ventas';

async function fixLIDsBulk() {
    console.log('Fetching large batch of messages from Evolution to map LIDs to phones...');

    try {
        let allRecords = [];
        let page = 1;
        const totalToFetch = 3000;
        const perPage = 100;
        
        while (allRecords.length < totalToFetch) {
            const url = `${BASE_URL}/chat/findMessages/${INSTANCE}`;
            const fetchRes = await fetch(url, {
                method: 'POST',
                headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ page: page, limit: perPage })
            });

            if (!fetchRes.ok) throw new Error('Failed to fetch: ' + fetchRes.status);
            const data = await fetchRes.json();
            
            const records = Array.isArray(data) ? data : (data?.response?.message?.records || data?.messages || null);
            
            if (!records || !Array.isArray(records) || records.length === 0) {
                console.log(`No more records at page ${page}`);
                break;
            }
            
            allRecords = allRecords.concat(records);
            console.log(`Fetched page ${page}, total records so far: ${allRecords.length}`);
            page++;
        }
        
        console.log(`\n✅ Total Messages Fetched: ${allRecords.length}`);
        
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
        console.log(`Found ${lidsFound.length} unique LID mappings!`);
        
        if (lidsFound.length === 0) return;
        
        let fixedCount = 0;
        for (const rawLid of lidsFound) {
            let realPhone = lidToPhoneMap[rawLid];
            realPhone = realPhone.replace(/\D/g, '');
            if (realPhone.startsWith('57') && realPhone.length === 12) realPhone = '+' + realPhone;
            
            // Comprobamos si la conversacion LID existe
            const checkLid = await pool.query('SELECT * FROM conversations WHERE phone = $1 OR phone = $2', [rawLid, `${rawLid}@lid`]);
            
            if (checkLid.rows.length > 0) {
                const conv = checkLid.rows[0];
                const actualLidPhone = conv.phone;
                
                console.log(`✅ Resolving: ${actualLidPhone} -> ${realPhone}`);
                
                try {
                    await pool.query(`
                        INSERT INTO conversations 
                        (phone, contact_name, ai_enabled, status, lead_intent, last_message_text, last_message_timestamp, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                        ON CONFLICT (phone) DO UPDATE SET
                        last_message_text = EXCLUDED.last_message_text,
                        last_message_timestamp = EXCLUDED.last_message_timestamp
                    `, [realPhone, conv.contact_name, conv.ai_enabled, conv.status, conv.lead_intent, conv.last_message_text, conv.last_message_timestamp]);

                    await pool.query('UPDATE messages SET conversation_phone = $1 WHERE conversation_phone = $2', [realPhone, actualLidPhone]);
                    await pool.query('UPDATE conversation_tags SET conversation_phone = $1 WHERE conversation_phone = $2 ON CONFLICT DO NOTHING', [realPhone, actualLidPhone]);
                    await pool.query('DELETE FROM conversation_tags WHERE conversation_phone = $1', [actualLidPhone]);
                    await pool.query('DELETE FROM conversations WHERE phone = $1', [actualLidPhone]);
                    
                    fixedCount++;
                } catch (err) {
                    console.error('Error in DB transfer for', rawLid, err.message);
                }
            }
        }
        
        console.log(`\n🎉 Finalizado! LIDs actualizados en DB: ${fixedCount}`);
        
    } catch(e) {
        console.error('Fatal', e);
    } finally {
        await pool.end();
    }

}
fixLIDsBulk();
