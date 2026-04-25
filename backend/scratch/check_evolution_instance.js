const axios = require('axios');
require('dotenv').config();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = 'large_cali';

async function checkInstance() {
    try {
        console.log(`Checking instance ${INSTANCE} at ${EVOLUTION_API_URL}...`);
        
        // Check instance state
        const stateRes = await axios.get(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE}`, {
            headers: { apikey: EVOLUTION_API_KEY }
        });
        console.log('Instance State:', stateRes.data);

        // Check settings
        const settingsRes = await axios.get(`${EVOLUTION_API_URL}/settings/find/${INSTANCE}`, {
            headers: { apikey: EVOLUTION_API_KEY }
        });
        console.log('Instance Settings:', JSON.stringify(settingsRows = settingsRes.data, null, 2));

    } catch (err) {
        console.error('Error checking instance:', err.response?.data || err.message);
    }
}

checkInstance();
