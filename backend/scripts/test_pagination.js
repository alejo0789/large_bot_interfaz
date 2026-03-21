const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'large_productosclientesfinales';

async function test() {
    let result = [];
    for (let p = 1; p <= 3; p++) {
        let rs = await fetch(`${BASE_URL}/chat/findChats/${INSTANCE}`, {
            method: 'POST',
            headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ where: {}, limit: 100, page: p })
        });
        let dt = await rs.json();
        let chats = Array.isArray(dt) ? dt : (dt.chats || []);
        console.log(`Page ${p}: ${chats.length} chats`);
        if (chats.length > 0) result.push(...chats);
    }
}
test();
