const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'large_productosclientesfinales';

async function test() {
    let rs1 = await fetch(`${BASE_URL}/chat/findChats/${INSTANCE}`, {
        method: 'POST',
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ take: 2000, skip: 0 })
    });
    let d1 = await rs1.json();
    let c1 = Array.isArray(d1) ? d1 : (d1.chats || []);
    console.log(`take2000 => ${c1.length}`);
}
test();
