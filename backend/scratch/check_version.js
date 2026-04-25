const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function checkVersion() {
    const baseUrl = 'https://evolution-api-production-8e62.up.railway.app';
    const apiKey = 'hash_12345';

    try {
        const response = await fetch(`${baseUrl}/instance/version`, {
            headers: { 'apikey': apiKey }
        });
        const data = await response.json();
        console.log('Evolution Version:', data);
    } catch (err) {
        console.error(err);
    }
}

checkVersion();
