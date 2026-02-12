const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

async function checkChats() {
    console.log('🔍 Fetching chats to verify API connection...');
    const url = `${BASE_URL}/chat/findChats/${INSTANCE}`;

    try {
        const response = await fetch(url, {
            headers: { 'apikey': API_KEY }
        });

        if (!response.ok) {
            console.error(`❌ API Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error('Response:', text);
            return;
        }

        const data = await response.json();
        console.log(`✅ Success! Found ${Array.isArray(data) ? data.length : 0} chats.`);

        if (Array.isArray(data) && data.length > 0) {
            console.log('Sample chat:', JSON.stringify(data[0], null, 2));
        } else {
            console.log('Raw data:', JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    }
}

checkChats();
