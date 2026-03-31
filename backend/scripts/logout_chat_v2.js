const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

async function logoutChatV2(instanceName) {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const url = `${baseUrl}/chat/logout/${instanceName}`;
    
    console.log(`📡 Attempting to logout CHAT: ${instanceName} at ${url}`);

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'apikey': apiKey }
        });
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

const instanceToDisconnect = 'large_sedeminutodios';
logoutChatV2(instanceToDisconnect);
