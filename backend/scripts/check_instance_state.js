const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

async function checkState(instanceName) {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const url = `${baseUrl}/instance/connectionState/${instanceName}`;
    
    console.log(`📡 Checking state for instance: ${instanceName} at ${url}`);

    try {
        const response = await fetch(url, {
            headers: { 'apikey': apiKey }
        });
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

const instanceToCheck = 'large_sedeminutodios';
checkState(instanceToCheck);
