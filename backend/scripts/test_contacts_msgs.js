const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'large_productosclientesfinales';

async function test() {
    let rs2 = await fetch(`${BASE_URL}/chat/findContacts/${INSTANCE}`, {
        method: 'POST',
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ where: { isGroup: false }, limit: 50 })
    });
    let d2 = await rs2.json();
    let contacts = Array.isArray(d2) ? d2 : (d2.contacts || d2.records || []);
    console.log(`Contacts found: ${contacts.length}`);
    
    let msgsFoundCount = 0;
    for (let c of contacts.slice(0, 10)) { // testing 10
        let msgUrl = `${BASE_URL}/chat/findMessages/${INSTANCE}`;
        let msgRes = await fetch(msgUrl, {
            method: 'POST',
            headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                where: { key: { remoteJid: c.remoteJid } },
                limit: 10
            })
        });
        if (msgRes.ok) {
            let msgData = await msgRes.json();
            let messages = Array.isArray(msgData) ? msgData : (msgData.messages || msgData.records || []);
            if (messages && messages.length > 0) msgsFoundCount++;
            console.log(`${c.remoteJid} -> ${messages ? messages.length : 0} msgs`);
        }
    }
}
test();
