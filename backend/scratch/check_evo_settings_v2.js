const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function checkEvolutionSettings() {
    const baseUrl = 'https://evolution-api-production-8e62.up.railway.app';
    const apiKey = 'hash_12345'; // Hopefully this works if it's the one in .env
    const instance = 'large_cali';

    try {
        console.log(`Checking settings for instance: ${instance} at ${baseUrl}`);
        const response = await fetch(`${baseUrl}/settings/find/${instance}`, {
            headers: { 'apikey': apiKey }
        });
        
        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error('Response:', text);
            return;
        }

        const data = await response.json();
        console.log('Settings:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Fetch failed:', err.message);
    }
}

checkEvolutionSettings();
