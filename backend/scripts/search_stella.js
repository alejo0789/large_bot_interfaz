const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

async function searchNameEverywhere() {
    console.log(`🔍 Searching for "Stella" in all chats...`);

    try {
        const response = await fetch(`${BASE_URL}/chat/findContacts/${INSTANCE}`, {
            method: 'POST',
            headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ where: {} })
        });
        const contacts = await response.json();
        console.log(`Loaded ${contacts.length} contacts.`);

        const matches = contacts.filter(c =>
            (c.pushName && c.pushName.toLowerCase().includes('stella')) ||
            (c.name && c.name.toLowerCase().includes('stella')) ||
            (c.verifiedName && c.verifiedName.toLowerCase().includes('stella'))
        );

        if (matches.length > 0) {
            console.log(`✅ Found ${matches.length} matches for "Stella":`);
            console.log(JSON.stringify(matches, null, 2));
        } else {
            console.log('❌ "Stella" not found in any contact field.');
            // Let's print the first 5 contacts to see if there's any field we missed
            console.log('Sample contact keys:', Object.keys(contacts[0]));
        }
    } catch (err) {
        console.error(err);
    }
}

searchNameEverywhere();
