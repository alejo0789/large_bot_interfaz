const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

const TARGET_PHONE = '573028061698';

async function searchPhoneInChats() {
    console.log(`🔍 Searching for ${TARGET_PHONE} in Evolution chats...`);
    const url = `${BASE_URL}/chat/findChats/${INSTANCE}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "where": {},
                "limit": 1000
            })
        });

        const chats = await response.json();
        console.log(`✅ Loaded ${chats.length} chats.`);

        const matches = chats.filter(c =>
            c.remoteJid.includes(TARGET_PHONE) ||
            (c.lastMessage?.key?.remoteJidAlt && c.lastMessage.key.remoteJidAlt.includes(TARGET_PHONE))
        );

        if (matches.length > 0) {
            console.log(`✅ Found ${matches.length} matches:`);
            console.log(JSON.stringify(matches, null, 2));
        } else {
            console.log(`❌ Phone ${TARGET_PHONE} not found in first 1000 chats.`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

searchPhoneInChats();
