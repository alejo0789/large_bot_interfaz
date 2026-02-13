const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;

async function checkInstanceConfig() {
    console.log(`🔍 Checking Global Instance Settings...`);

    // 1. Fetch all instances to see config
    try {
        const url = `${BASE_URL}/instance/fetchInstances`;
        const response = await fetch(url, {
            headers: { 'apikey': API_KEY }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Instances Found:', data.length);
            if (data.length > 0) {
                const inst = data.find(i => i.name === process.env.EVOLUTION_INSTANCE || i.instance?.instanceName === process.env.EVOLUTION_INSTANCE) || data[0];
                console.log('📄 Instance Config (Snippet):', JSON.stringify(inst, null, 2));
            }
        } else {
            console.log(`❌ Failed to fetch instances: ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Error fetching instances:', error.message);
    }
}

checkInstanceConfig();
