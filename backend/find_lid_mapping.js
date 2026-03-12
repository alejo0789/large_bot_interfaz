require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function findMapping() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = 'large_sedeminutodios';
    const targetLid = '11953128890546';

    console.log(`🔎 Buscando mapeo para LID: ${targetLid} en contactos...`);
    try {
        const response = await fetch(`${baseUrl}/contact/findContacts/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({})
        });
        const contacts = await response.json();
        const list = Array.isArray(contacts) ? contacts : (contacts.data || []);

        console.log(`Total contactos: ${list.length}`);
        for (const contact of list) {
            // Buscamos si el LID aparece en algún lado
            const fullStr = JSON.stringify(contact);
            if (fullStr.includes(targetLid)) {
                console.log(`\n--- CONTACTO ENCONTRADO ---`);
                console.log(JSON.stringify(contact, null, 2));
            }
        }
    } catch (e) {
        console.error(e);
    }
}
findMapping();
