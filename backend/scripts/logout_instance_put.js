const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

async function logoutInstancePut(instanceName) {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const url = `${baseUrl}/instance/logout/${instanceName}`;
    
    console.log(`📡 Attempting to logout instance (PUT): ${instanceName} at ${url}`);

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'apikey': apiKey }
        });
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
        
        if (response.ok) {
            console.log(`✅ Instance ${instanceName} logged out successfully (PUT).`);
        } else {
            console.error(`❌ Failed to logout instance (PUT). Status: ${response.status}`);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

const instanceToDisconnect = 'large_sedeminutodios';
logoutInstancePut(instanceToDisconnect);
