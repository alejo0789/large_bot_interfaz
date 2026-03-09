require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function fetchAllContacts() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = 'large_sedeminutodios';

    console.log(`📋 Obteniendo todos los contactos para ${instance}...`);
    try {
        const response = await fetch(`${baseUrl}/contact/findContacts/${instance}`, {
            method: 'GET',
            headers: { 'apikey': apiKey }
        });
        const data = await response.json();
        const contacts = Array.isArray(data) ? data : (data.contacts || data.data || []);

        console.log(`Total contactos: ${contacts.length}`);

        const targets = ['56036438372368', '14306653515995', '110664244809851'];
        for (const contact of contacts) {
            const jid = contact.id || contact.remoteJid || "";
            if (targets.some(t => jid.includes(t))) {
                console.log(`\n--- CONTACTO ENCONTRADO: ${jid} ---`);
                console.log(JSON.stringify(contact, null, 2));
            }
        }
    } catch (e) {
        console.error(e.message);
    }
}

fetchAllContacts();
