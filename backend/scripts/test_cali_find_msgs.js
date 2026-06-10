require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function test() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-8e62.up.railway.app';
    const apiKey = process.env.EVOLUTION_API_KEY || 'hash_12345';
    const instance = 'large_cali';
    const msgUrl = `${baseUrl}/chat/findMessages/${instance}`;
    
    console.log(`📡 Fetching from: ${msgUrl}`);
    let msgRes = await fetch(msgUrl, {
        method: 'POST',
        headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            where: {},
            take: 5,
            skip: 0
        })
    });
    
    if (msgRes.ok) {
        let msgData = await msgRes.json();
        console.log('Raw response type:', typeof msgData, Array.isArray(msgData) ? 'Array' : 'Object');
        console.log('Raw response keys:', Object.keys(msgData));
        console.log('Raw response sample:', JSON.stringify(msgData, null, 2).slice(0, 1500));
    } else {
        console.error('Failed:', msgRes.status, await msgRes.text());
    }
}
test();
