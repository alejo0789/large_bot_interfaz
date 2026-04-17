const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'distribuidores_ventas';

async function test() {
    const msgRes = await fetch(`${BASE_URL}/chat/findMessages/${INSTANCE}`, { 
        method: 'POST', 
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ where: { key: { remoteJid: '102344926736392@lid' } }, limit: 5 }) 
    });
    const msgs = await msgRes.json();
    console.log(JSON.stringify(msgs, null, 2));
}
test();
