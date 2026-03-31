const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

async function logoutInstance(instanceName) {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    
    // We try logout first
    const url = `${baseUrl}/instance/logout/${instanceName}`;
    console.log(`📡 Attempting to logout instance: ${instanceName} at ${url}`);

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'apikey': apiKey }
        });
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
        
        if (response.ok) {
            console.log(`✅ Instance ${instanceName} logged out successfully.`);
        } else {
            console.error(`❌ Failed to logout instance ${instanceName}. Status: ${response.status}`);
            
            // If logout fails, maybe try delete? 
            // Or maybe the endpoint is different.
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

const instanceToDisconnect = 'large_sedeminutodios';
logoutInstance(instanceToDisconnect);
