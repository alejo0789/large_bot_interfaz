const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

async function testFetchContacts() {
    console.log('🔍 Testing various contact endpoints...');

    const endpoints = [
        { url: `${BASE_URL}/contact/findContacts/${INSTANCE}`, method: 'POST', body: { where: {} } },
        { url: `${BASE_URL}/contact/fetchContacts/${INSTANCE}`, method: 'GET' },
        { url: `${BASE_URL}/chat/findChats/${INSTANCE}`, method: 'POST', body: { where: {}, limit: 50 } }
    ];

    for (const endpoint of endpoints) {
        console.log(`📡 Trying ${endpoint.method} ${endpoint.url}...`);
        try {
            const options = {
                method: endpoint.method,
                headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' }
            };
            if (endpoint.body) options.body = JSON.stringify(endpoint.body);

            const response = await fetch(endpoint.url, options);
            const data = await response.json();

            if (response.ok) {
                console.log(`✅ SUCCESS with ${endpoint.url}`);
                const count = Array.isArray(data) ? data.length : (data.response ? 'object' : 'unknown');
                console.log(`   Found ${count} results.`);

                let foundNames = 0;
                if (Array.isArray(data)) {
                    data.slice(0, 10).forEach(item => {
                        const name = item.name || item.pushName || item.verifiedName || item.subject;
                        if (name && !name.includes('@')) {
                            console.log(`   - [${item.id || item.remoteJid}] Name: ${name}`);
                            foundNames++;
                        }
                    });
                }

                if (foundNames > 0) {
                    console.log(`✅ Found ${foundNames} names in first 10 results.`);
                    // Let's print one full record to see all fields
                    const firstWithName = data.find(item => (item.name || item.pushName || item.verifiedName) && !(item.name || item.pushName).includes('@'));
                    if (firstWithName) {
                        console.log('Sample record with name:', JSON.stringify(firstWithName, null, 2));
                    }
                    return; // Stop after first success with names
                }
            } else {
                console.log(`❌ Failed ${endpoint.url}: ${response.status}`);
            }
        } catch (error) {
            console.error(`❌ Error with ${endpoint.url}:`, error.message);
        }
    }
}

testFetchContacts();
