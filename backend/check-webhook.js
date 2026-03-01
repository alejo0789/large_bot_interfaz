
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const instance = 'large_alejo_wp2';
const apiKey = 'hash_12345';
const baseUrl = 'https://evolution-api-production-8e62.up.railway.app';

async function check() {
    const url = `${baseUrl}/webhook/find/${instance}`;
    const res = await fetch(url, {
        headers: { 'apikey': apiKey }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

check();
