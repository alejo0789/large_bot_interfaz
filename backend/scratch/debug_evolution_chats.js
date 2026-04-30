const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'large_medellin2';

async function checkAllChats() {
    const res = await fetch(`${BASE_URL}/chat/findChats/${INSTANCE}`, {
        method: 'POST',
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ where: {}, limit: 5000 })
    });

    if (res.ok) {
        const data = await res.json();
        const chats = Array.isArray(data) ? data : (data.chats || []);
        console.log(`Evolution has ${chats.length} chats.`);
        if (chats.length > 0) {
            console.log("Dates of oldest/newest:");
            const dates = chats.map(c => c.conversationTimestamp || c.messageTimestamp).filter(Boolean).sort();
            if (dates.length > 0) {
                console.log(`Oldest: ${new Date(dates[0] * 1000).toISOString()}`);
                console.log(`Newest: ${new Date(dates[dates.length - 1] * 1000).toISOString()}`);
            }
        }
    } else {
        console.error("Error:", res.status);
    }
}

checkAllChats();
