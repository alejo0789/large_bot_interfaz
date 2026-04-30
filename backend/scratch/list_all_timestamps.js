const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'large_medellin2';

async function listAllChatTimestamps() {
    const res = await fetch(`${BASE_URL}/chat/findChats/${INSTANCE}`, {
        method: 'POST',
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ where: {}, limit: 100 })
    });

    if (res.ok) {
        const data = await res.json();
        const chats = Array.isArray(data) ? data : (data.chats || []);
        console.log(`Total chats: ${chats.length}`);
        chats.forEach((c, i) => {
            const ts = c.lastMessage?.messageTimestamp || c.messageTimestamp || c.conversationTimestamp;
            const date = ts ? new Date(ts * 1000).toISOString() : 'Unknown';
            const name = c.pushName || c.name || c.remoteJid;
            console.log(`${i+1}. ${name}: ${date}`);
        });
    }
}

listAllChatTimestamps();
