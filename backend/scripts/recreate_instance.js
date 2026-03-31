const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

async function createInstance(instanceName) {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const url = `${baseUrl}/instance/create`;
    
    console.log(`📡 Attempting to RE-CREATE instance: ${instanceName} at ${url}`);

    const body = {
        instanceName: instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'apikey': apiKey 
            },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

const instanceToCreate = 'large_sedeminutodios';
createInstance(instanceToCreate);
