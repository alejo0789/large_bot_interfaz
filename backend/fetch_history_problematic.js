require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function fetchHistory() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = 'large_sedeminutodios';
    const jid = '26092043796715@lid';

    console.log(`📋 Trayendo historial completo para ${jid}...`);
    try {
        const response = await fetch(`${baseUrl}/chat/findMessages/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({
                where: { key: { remoteJid: jid } },
                limit: 100
            })
        });
        const data = await response.json();
        const messages = Array.isArray(data) ? data : (data.messages?.records || data.data || []);

        console.log(`Total mensajes: ${messages.length}`);
        for (const msg of messages) {
            console.log(`\n--- Msg ---`);
            console.log(`ID: ${msg.key.id}`);
            console.log(`FromMe: ${msg.key.fromMe}`);
            console.log(`PushName: ${msg.pushName}`);
            if (msg.message?.conversation) console.log(`Text: ${msg.message.conversation}`);
            if (msg.message?.extendedTextMessage?.text) console.log(`Text: ${msg.message.extendedTextMessage.text}`);
        }
    } catch (e) {
        console.error(e.message);
    }
}

fetchHistory();
