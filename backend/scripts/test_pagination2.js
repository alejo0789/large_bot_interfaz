const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'large_productosclientesfinales';

async function test() {
    let rs0 = await fetch(`${BASE_URL}/chat/findChats/${INSTANCE}`, {
        method: 'POST',
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ where: {}, limit: 10, offset: 0 })
    });
    let d0 = await rs0.json();
    let c0 = Array.isArray(d0) ? d0 : (d0.chats || []);
    
    let rs1 = await fetch(`${BASE_URL}/chat/findChats/${INSTANCE}`, {
        method: 'POST',
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ where: {}, limit: 10, offset: 10 })
    });
    let d1 = await rs1.json();
    let c1 = Array.isArray(d1) ? d1 : (d1.chats || []);
    
    console.log(`c0: ${c0.map(c => c.id || c.remoteJid).slice(0, 3)}`);
    console.log(`c1: ${c1.map(c => c.id || c.remoteJid).slice(0, 3)}`);
}
test();
