const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

async function checkEndpoints() {
    console.log(`🔍 Testing Evolution API Endpoints for Instance: ${INSTANCE}`);
    console.log(`📡 Base URL: ${BASE_URL}`);

    // List of potential endpoints to try (v1 & v2 variations)
    const endpoints = [
        `/chat/findChats/${INSTANCE}`,          // v1 Standard
        `/chat/findMessages/${INSTANCE}`,       // v1 Messages
        `/chat/retriever/${INSTANCE}`,          // v2 Chat Retriever
        `/chat/find/${INSTANCE}`,               // v2 Find
        `/message/fetch/${INSTANCE}`,           // v2 Message Fetch
        `/instance/connectionState/${INSTANCE}` // Health Check (should work)
    ];

    for (const endpoint of endpoints) {
        const url = `${BASE_URL}${endpoint}`;
        console.log(`\nTesting: ${endpoint}...`);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'apikey': API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`👉 Status: ${response.status} ${response.statusText}`);

            if (response.ok) {
                const data = await response.json();
                const isArray = Array.isArray(data);
                const count = isArray ? data.length : (data.messages ? data.messages.length : 'N/A');
                console.log(`✅ SUCCESS! Data Type: ${isArray ? 'Array' : 'Object'}, Count: ${count}`);
                // console.log('Snippet:', JSON.stringify(data).substring(0, 100)); 
            } else {
                // Try to read error body
                try {
                    const errText = await response.text();
                    console.log(`❌ Error Body: ${errText.substring(0, 150)}`);
                } catch (e) { }
            }

        } catch (error) {
            console.error(`❌ Connection Failed: ${error.message}`);
        }
    }
}

checkEndpoints();
