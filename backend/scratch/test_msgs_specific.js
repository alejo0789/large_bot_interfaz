const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'distribuidores_ventas';

async function test() {
    const msgRes = await fetch(`${BASE_URL}/chat/findMessages/${INSTANCE}`, { 
        method: 'POST', 
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ where: { key: { remoteJid: '573114683297@s.whatsapp.net' } }, limit: 100 }) 
    });
    const msgs = await msgRes.json();
    const records = Array.isArray(msgs) ? msgs : (msgs.messages?.records || msgs.records || []);
    console.log(`Evolution tiene ${records.length} mensajes para este JID.`);
    if (records.length > 0) {
        console.log(`Último mensaje en Evo: "${records[0].message?.conversation || '...'}" @ ${new Date(records[0].messageTimestamp * 1000).toISOString()}`);
    }
}
test();
