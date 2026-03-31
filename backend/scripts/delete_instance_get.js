const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

async function deleteInstanceGet(instanceName) {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const url = `${baseUrl}/instance/delete/${instanceName}`;
    
    console.log(`📡 Attempting to delete instance (GET): ${instanceName} at ${url}`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'apikey': apiKey }
        });
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

const instanceToDelete = 'large_sedeminutodios';
deleteInstanceGet(instanceToDelete);
