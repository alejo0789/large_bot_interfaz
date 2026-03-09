require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function inspectChats() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = 'large_sedeminutodios';

    try {
        const response = await fetch(`${baseUrl}/chat/findChats/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({})
        });

        const data = await response.json();
        const chats = Array.isArray(data) ? data : (data.chats || data.data || []);

        console.log(`Total chats: ${chats.length}`);

        // Buscamos los que reportó el usuario
        const targets = ['56036438372368', '14306653515995', '30155183550673'];

        for (const chat of chats) {
            const id = chat.id || chat.remoteJid || "";
            if (targets.some(t => id.includes(t))) {
                console.log(`\n--- ENCONTRADO: ${id} ---`);
                console.log(JSON.stringify(chat, null, 2));
            }
        }

    } catch (error) {
        console.error(error);
    }
}

inspectChats();
