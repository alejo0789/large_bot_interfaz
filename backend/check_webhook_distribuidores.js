const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'distribuidores_ventas';

async function checkWebhook() {
    console.log(`🔍 Checking Webhook for instance: ${INSTANCE}`);
    try {
        const response = await fetch(`${BASE_URL}/webhook/find/${INSTANCE}`, {
            method: 'GET',
            headers: {
                'apikey': API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`Error fetching webhook: ${response.status} ${response.statusText}`);
            console.log(await response.text());
            return;
        }

        const data = await response.json();
        console.log("Webhook configuration:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Fetch error:", error);
    }
}

checkWebhook();
