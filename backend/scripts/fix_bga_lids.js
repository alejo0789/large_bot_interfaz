const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/cuadros_bga_db?sslmode=require';
const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = process.env.EVOLUTION_API_KEY || '8B96AC4A3CB1-4CA9-A7C7-41DA1BE2EA74';
const INSTANCE = 'large_caudrosbga_1';

async function fixLids() {
    console.log('🚀 Iniciando resolución de LIDs...');
    
    // Select all phones that are fully numeric but longer than 13, and their '+' counterparts
    const { rows: lids } = await pool.query(`SELECT phone FROM conversations WHERE (phone NOT LIKE '+57%' AND length(phone) > 13 AND phone ~ '^[0-9]+$') OR (phone NOT LIKE '+57%' AND length(phone) > 14 AND phone ~ '^\\+[0-9]+$')`);
    console.log(`🔍 LIDs totales en DB: ${lids.length}`);

    let fixedCount = 0;
    
    for (const lidRow of lids) {
        const lidPhoneStr = lidRow.phone; // e.g. +69033462354077
        const lidClean = lidPhoneStr.replace('+', ''); // 69033462354077
        
        try {
            const url = `${BASE_URL}/chat/findMessages/${INSTANCE}`;
            const msgRes = await fetch(url, {
                method: 'POST',
                headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    where: { key: { remoteJid: `${lidClean}@lid` } },
                    limit: 10
                })
            });

            if (!msgRes.ok) {
                console.log(`Failed to fetch for ${lidClean}@lid`);
                continue;
            }

            const msgData = await msgRes.json();
            let messages = [];

            if (Array.isArray(msgData)) messages = msgData;
            else if (Array.isArray(msgData.messages)) messages = msgData.messages;
            else if (msgData.messages && Array.isArray(msgData.messages.records)) messages = msgData.messages.records;
            else if (Array.isArray(msgData.records)) messages = msgData.records;

            let realPhone = null;

            for (const msg of messages) {
                if (msg.key) {
                    const j1 = msg.key.remoteJid;
                    const j2 = msg.key.remoteJidAlt;
                    const p1 = msg.key.participant;
                    const p2 = msg.key.participantAlt;
                    
                    const check = (jid1, jid2) => {
                        if (!jid1 || !jid2) return null;
                        jid1 = jid1.split('@')[0];
                        jid2 = jid2.split('@')[0];
                        if (String(jid1).includes(lidClean) && !String(jid2).includes('lid') && jid2.length < 16) return jid2;
                        if (String(jid2).includes(lidClean) && !String(jid1).includes('lid') && jid1.length < 16) return jid1;
                        return null;
                    };
                    
                    realPhone = realPhone || check(j1, j2) || check(p1, p2);
                    if (realPhone) break;
                }
            }

            if (realPhone) {
                realPhone = realPhone.replace(/\D/g, '');
                if (realPhone.startsWith('57') && realPhone.length === 12) realPhone = '+' + realPhone;
                // Otherwise prepend +
                else if (realPhone.length >= 10 && realPhone.length <= 13 && !realPhone.startsWith('+')) realPhone = '+' + realPhone;
                
                console.log(`   🛠️ MAP: ${lidPhoneStr} -> ${realPhone}`);
                
                const { rows: realConv } = await pool.query('SELECT * FROM conversations WHERE phone = $1', [realPhone]);
                if (realConv.length > 0) {
                    await pool.query('UPDATE messages SET conversation_phone = $1 WHERE conversation_phone = $2', [realPhone, lidPhoneStr]);
                    try {
                        await pool.query('UPDATE conversation_tags SET conversation_phone = $1 WHERE conversation_phone = $2', [realPhone, lidPhoneStr]);
                    } catch(e) {}
                    await pool.query('DELETE FROM conversation_tags WHERE conversation_phone = $1', [lidPhoneStr]);
                    await pool.query('DELETE FROM conversations WHERE phone = $1', [lidPhoneStr]);
                } else {
                     await pool.query('UPDATE conversations SET phone = $1 WHERE phone = $2', [realPhone, lidPhoneStr]);
                }
                
                fixedCount++;
            }
        } catch (e) {
            console.error(`Error procesando ${lidPhoneStr}:`, e.message);
        }
    }
    
    console.log(`🎉 LIDs reparados: ${fixedCount}`);
    process.exit(0);
}

fixLids();
