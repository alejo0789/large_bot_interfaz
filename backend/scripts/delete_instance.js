const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

async function deleteInstance(instanceName) {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const url = `${baseUrl}/instance/delete/${instanceName}`;
    
    console.log(`📡 Force DELETING instance: ${instanceName} at ${url}`);

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'apikey': apiKey }
        });
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
        
        if (response.ok) {
            console.log(`✅ Instance ${instanceName} DELETED successfully.`);
        } else {
            console.error(`❌ Failed to delete instance ${instanceName}. Status: ${response.status}`);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

const instanceToDelete = 'large_sedeminutodios';
deleteInstance(instanceToDelete);
