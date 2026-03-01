
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const baseUrl = 'https://evolution-api-production-8e62.up.railway.app';
const apiKey = '0B78460668F3-43D9-967E-C5819777123A';
const instance = 'large_alejo_wp2';

async function probeMediaEndpoint() {
    const endpoints = [
        `/chat/getBase64FromMessage/${instance}`,
        `/message/getBase64/${instance}`,
        `/chat/getMedia/${instance}`
    ];

    for (const ep of endpoints) {
        console.log(`Probing: ${ep}`);
        try {
            const res = await fetch(`${baseUrl}${ep}`, {
                method: 'POST',
                headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: { key: { id: 'test' } } }) // Dummy body
            });
            console.log(`   Status: ${res.status}`);
            if (res.status !== 404) {
                console.log(`   Response:`, await res.text());
            }
        } catch (e) {
            console.log(`   Error: ${e.message}`);
        }
    }
}

probeMediaEndpoint();
