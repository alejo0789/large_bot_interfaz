const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

async function deleteInstanceById(instanceId) {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const url = `${baseUrl}/instance/delete/${instanceId}`;
    
    console.log(`📡 Force DELETING instance by ID: ${instanceId} at ${url}`);

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'apikey': apiKey }
        });
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
        
        if (response.ok) {
            console.log(`✅ Instance ID ${instanceId} DELETED successfully.`);
        } else {
            console.error(`❌ Failed to delete instance by ID. Status: ${response.status}`);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

const idToDelete = '1b223dfb-a5f3-4e9d-b97c-958a56d8c5d9';
deleteInstanceById(idToDelete);
