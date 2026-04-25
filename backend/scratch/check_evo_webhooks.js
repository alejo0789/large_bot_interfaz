const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function checkEvolutionWebhooks() {
    const baseUrl = 'https://evolution-api-production-8e62.up.railway.app';
    const apiKey = 'hash_12345';
    const instance = 'large_cali';

    try {
        console.log(`Checking webhooks for instance: ${instance}`);
        const response = await fetch(`${baseUrl}/webhook/find/${instance}`, {
            headers: { 'apikey': apiKey }
        });
        
        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            return;
        }

        const data = await response.json();
        console.log('Webhooks:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Fetch failed:', err.message);
    }
}

checkEvolutionWebhooks();
