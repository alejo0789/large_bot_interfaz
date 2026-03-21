const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'large_productosclientesfinales';

async function test() {
    let rs1 = await fetch(`${BASE_URL}/chat/findChats/${INSTANCE}`, {
        method: 'POST',
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ take: 20, skip: 20 })
    });
    let d1 = await rs1.json();
    let c1 = Array.isArray(d1) ? d1 : (d1.chats || []);
    console.log(`take/skip c1 size: ${c1.length}`);
    if (c1.length > 0) console.log(c1.map(c => c.id || c.remoteJid).slice(0, 3));
    
    // Also let's see how many records Evolution API's SQLite/Postgres actually has synced for this instance:
    // Some versions don't paginate at all, just return everything or max limit hardcoded.
}
test();
