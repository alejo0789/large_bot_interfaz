require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function resolveLid() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = 'large_sedeminutodios';
    const lid = '56036438372368@lid';

    console.log(`🔍 Intentando resolver LID: ${lid}`);

    const endpoints = [
        `/chat/resolveLid/${instance}?jid=${lid}`,
        `/chat/whatsappNumbers/${instance}` // Check if this resolves it too
    ];

    for (const endpoint of endpoints) {
        try {
            const url = `${baseUrl}${endpoint}`;
            console.log(`📡 Probando: ${url}`);

            const response = await fetch(url, {
                method: endpoint.includes('whatsappNumbers') ? 'POST' : 'GET',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: endpoint.includes('whatsappNumbers') ? JSON.stringify({ numbers: [lid.split('@')[0]] }) : null
            });

            const data = await response.json();
            console.log(`Respuesta (${endpoint}):`, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(`Error en ${endpoint}:`, e.message);
        }
    }
}

resolveLid();
