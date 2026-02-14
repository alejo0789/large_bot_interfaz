const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

async function discoverContactEndpoints() {
    console.log(`🔍 Discovering Contact Endpoints for ${INSTANCE}...`);

    const variations = [
        { url: '/contact/findContacts', method: 'POST', body: { where: {} } },
        { url: '/contact/fetchContacts', method: 'GET' },
        { url: '/contact/list', method: 'GET' },
        { url: '/chat/findContacts', method: 'POST', body: { where: {} } },
        { url: '/group/findContacts', method: 'POST', body: { where: {} } },
        { url: '/contact/v2/contacts', method: 'GET' },
        { url: '/contact/v2/findContacts', method: 'POST', body: { where: {} } }
    ];

    for (const v of variations) {
        const fullUrl = `${BASE_URL}${v.url}/${INSTANCE}`;
        console.log(`📡 Trying ${v.method} ${fullUrl}...`);
        try {
            const options = {
                method: v.method,
                headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' }
            };
            if (v.body) options.body = JSON.stringify(v.body);

            const response = await fetch(fullUrl, options);
            const data = await response.json();

            if (response.ok) {
                console.log(`✅ SUCCESS with ${v.url}`);
                console.log(`   Data: ${JSON.stringify(data).substring(0, 200)}...`);
            } else {
                console.log(`❌ Failed ${v.url}: ${response.status}`);
            }
        } catch (error) {
            console.error(`❌ Error with ${v.url}:`, error.message);
        }
    }
}

discoverContactEndpoints();
