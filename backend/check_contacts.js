require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function checkContacts() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = 'large_sedeminutodios';
    const lids = ['56036438372368@lid', '14306653515995@lid', '110664244809851@lid'];

    for (const lid of lids) {
        console.log(`\n🔍 Buscando contacto para: ${lid}`);
        try {
            const response = await fetch(`${baseUrl}/contact/search/${instance}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({ where: { remoteJid: lid } })
            });
            const data = await response.json();
            console.log(JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(e.message);
        }
    }
}

checkContacts();
