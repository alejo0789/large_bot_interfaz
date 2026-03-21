const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'large_productosclientesfinales';

async function test() {
    let msgUrl = `${BASE_URL}/chat/findMessages/${INSTANCE}`;
    let msgRes = await fetch(msgUrl, {
        method: 'POST',
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            where: {},
            take: 1000,
            skip: 0
        })
    });
    if (msgRes.ok) {
        let msgData = await msgRes.json();
        let msgs = Array.isArray(msgData) ? msgData : (msgData.messages || msgData.records || []);
        console.log(`Global messages found in Evolution: ${msgs.length}`);
    } else {
        console.error(await msgRes.text());
    }
}
test();
