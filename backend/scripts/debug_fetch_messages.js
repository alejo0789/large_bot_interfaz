const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

const TARGET_JID = '573145325141-1571002611@g.us'; // Grupo El Parchis Yopal

async function debugMessages() {
    console.log(`🔍 Fetching messages for ${TARGET_JID}...`);
    const url = `${BASE_URL}/chat/findMessages/${INSTANCE}`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "where": {
                    "key": {
                        "remoteJid": TARGET_JID
                    }
                },
                "limit": 5
            })
        });

        if (!res.ok) {
            console.error(`❌ Error ${res.status}: ${await res.text()}`);
            return;
        }

        const data = await res.json();
        const messages = Array.isArray(data) ? data : (data.messages || []);

        console.log(`✅ Success! Found ${messages.length} messages.`);
        if (messages.length > 0) {
            console.log('Sample Message:', JSON.stringify(messages[0], null, 2));
        } else {
            console.log('Wait, 0 messages found? Checking payload structure...');
            console.log('Response data:', JSON.stringify(data, null, 2));
        }

    } catch (e) {
        console.error('❌ Connection failed:', e);
    }
}

debugMessages();
