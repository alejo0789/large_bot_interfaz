require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testResolve() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-8e62.up.railway.app';
    const apiKey = process.env.EVOLUTION_API_KEY || 'hash_12345';
    const instance = 'large_cali';
    const lid = '212369691152434@lid';

    console.log(`Testing LID resolution for: ${lid} on instance: ${instance}`);

    // Try resolveLid
    try {
        const url = `${baseUrl}/chat/resolveLid/${instance}?jid=${lid}`;
        console.log(`URL: ${url}`);
        const res = await fetch(url, {
            headers: { 'apikey': apiKey }
        });
        console.log(`Status resolveLid: ${res.status}`);
        const data = await res.json();
        console.log('Data resolveLid:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error in resolveLid:', e.message);
    }

    // Try checkNumber (whatsappNumbers)
    try {
        const cleanNumber = lid.replace(/\D/g, '');
        const url = `${baseUrl}/chat/whatsappNumbers/${instance}`;
        console.log(`URL checkNumber: ${url} with number: ${cleanNumber}`);
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ numbers: [cleanNumber] })
        });
        console.log(`Status checkNumber: ${res.status}`);
        const data = await res.json();
        console.log('Data checkNumber:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error in checkNumber:', e.message);
    }
}

testResolve();
