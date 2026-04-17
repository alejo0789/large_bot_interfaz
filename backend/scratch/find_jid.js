const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'distribuidores_ventas';

async function findJid() {
    const chatRes = await fetch(`${BASE_URL}/chat/findChats/${INSTANCE}`, { 
        method: 'POST', 
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ where: {}, limit: 500 }) 
    });
    const chats = await chatRes.json();
    const match = chats.find(c => (c.remoteJid || '').includes('3114683297'));
    console.log(JSON.stringify(match, null, 2));
}
findJid();
