const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'large_productosclientesfinales';

async function test() {
    let rs2 = await fetch(`${BASE_URL}/chat/findContacts/${INSTANCE}`, {
        method: 'POST',
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ where: {} })
    });
    let d2 = await rs2.json();
    let contacts = Array.isArray(d2) ? d2 : (d2.contacts || d2.records || []);
    console.log(`Contacts found: ${contacts.length}`);
    if (contacts.length > 0) {
        console.log("Sample contact JID: ", contacts[0].id || contacts[0].remoteJid);
    }
}
test();
