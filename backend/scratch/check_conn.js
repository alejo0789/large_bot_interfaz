const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function checkConnection() {
    const baseUrl = 'https://evolution-api-production-8e62.up.railway.app';
    const apiKey = 'hash_12345';
    const instance = 'large_cali';

    try {
        const response = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
            headers: { 'apikey': apiKey }
        });
        const data = await response.json();
        console.log('Connection state:', data);
    } catch (err) {
        console.error(err);
    }
}

checkConnection();
