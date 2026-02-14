const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

const TARGET_PHONE = '573187999686';

async function debugSpecificContact() {
    console.log(`🔍 Debugging contact fields for ${TARGET_PHONE}...`);

    // We'll try both findContacts and findChats to see everything
    const endpoints = [
        { url: '/chat/findContacts', method: 'POST', body: { where: { remoteJid: `${TARGET_PHONE}@s.whatsapp.net` } } },
        { url: '/chat/findChats', method: 'POST', body: { where: { remoteJid: `${TARGET_PHONE}@s.whatsapp.net` } } }
    ];

    for (const e of endpoints) {
        console.log(`📡 Trying ${e.method} ${e.url}...`);
        try {
            const response = await fetch(`${BASE_URL}${e.url}/${INSTANCE}`, {
                method: e.method,
                headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify(e.body)
            });
            const data = await response.json();
            console.log(`Results from ${e.url}:`, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`❌ Error with ${e.url}:`, error.message);
        }
    }
}

debugSpecificContact();
