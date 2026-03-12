require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function findLidInfo() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = 'large_sedeminutodios';
    const targets = ['14568881397895', '26092043796715'];

    try {
        const response = await fetch(`${baseUrl}/chat/findChats/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({})
        });

        const chats = await response.json();
        const list = Array.isArray(chats) ? chats : (chats.chats || chats.data || []);

        for (const chat of list) {
            const jid = chat.id || chat.remoteJid || "";
            if (targets.some(t => jid.includes(t))) {
                console.log(`\n--- CHAT ENCONTRADO ---`);
                console.log(JSON.stringify(chat, null, 2));
            }
        }

    } catch (error) {
        console.error(error);
    }
}

findLidInfo();
