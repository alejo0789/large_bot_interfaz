require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testResolution() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = 'large_sedeminutodios';
    const lid = '11953128890546@lid';

    console.log(`🧪 Probando resolución de LID: ${lid}`);

    // Intento 1: /chat/whatsappNumbers (si existe en esta versión)
    try {
        const res = await fetch(`${baseUrl}/chat/whatsappNumbers/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({ numbers: [lid] })
        });
        const data = await res.json();
        console.log("--- Respuesta whatsappNumbers ---");
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.log("whatsappNumbers falló o no existe");
    }

    // Intento 2: /contact/checkHome (algunas versiones lo tienen)
    try {
        const res = await fetch(`${baseUrl}/contact/checkHome/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({ numbers: [lid] })
        });
        const data = await res.json();
        console.log("--- Respuesta checkHome ---");
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.log("checkHome falló o no existe");
    }
}
testResolution();
