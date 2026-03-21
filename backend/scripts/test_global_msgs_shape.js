const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'large_productosclientesfinales';

async function test() {
    let msgUrl = `${BASE_URL}/chat/findMessages/${INSTANCE}`;
    let msgRes = await fetch(msgUrl, {
        method: 'POST',
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ take: 2, skip: 0 })
    });
    if (msgRes.ok) {
        let msgData = await msgRes.json();
        console.log(JSON.stringify(msgData).substring(0, 1000));
    }
}
test();
