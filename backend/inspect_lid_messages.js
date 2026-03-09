require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function inspectLidMessages() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = 'large_sedeminutodios';
    const lid = '56036438372368@lid';

    try {
        const response = await fetch(`${baseUrl}/chat/findMessages/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({
                where: { key: { remoteJid: lid } },
                limit: 10
            })
        });

        const data = await response.json();
        const messages = Array.isArray(data) ? data : (data.messages?.records || data.data || []);

        console.log(`LID: ${lid}`);
        console.log(`Messages found: ${messages.length}`);

        for (const msg of messages) {
            console.log(`\n--- Message ---`);
            console.log(`fromMe: ${msg.key.fromMe}`);
            console.log(`pushName: ${msg.pushName}`);
            console.log(`text: ${msg.message?.conversation || msg.message?.extendedTextMessage?.text}`);
        }

    } catch (error) {
        console.error(error);
    }
}

inspectLidMessages();
