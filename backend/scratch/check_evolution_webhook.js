const axios = require('axios');
require('dotenv').config();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = 'large_cali';

async function checkWebhook() {
    try {
        console.log(`Checking Webhook for ${INSTANCE}...`);
        const res = await axios.get(`${EVOLUTION_API_URL}/webhook/find/${INSTANCE}`, {
            headers: { apikey: EVOLUTION_API_KEY }
        });
        console.log('Webhook Settings:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('Error checking webhook:', err.response?.data || err.message);
    }
}

checkWebhook();
