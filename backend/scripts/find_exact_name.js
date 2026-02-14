const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

const TARGET_NAME = "Stella Rivas especialista";

async function findExactName() {
    console.log(`🔍 Searching for exact name "${TARGET_NAME}"...`);

    try {
        const response = await fetch(`${BASE_URL}/chat/findContacts/${INSTANCE}`, {
            method: 'POST',
            headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ where: {} })
        });
        const contacts = await response.json();

        const matches = contacts.filter(c =>
            Object.values(c).some(val => typeof val === 'string' && val.toLowerCase().includes(TARGET_NAME.toLowerCase()))
        );

        if (matches.length > 0) {
            console.log(`✅ Found ${matches.length} matches:`);
            console.log(JSON.stringify(matches, null, 2));
        } else {
            console.log(`❌ No exact matches found for "${TARGET_NAME}".`);
        }
    } catch (err) {
        console.error(err);
    }
}

findExactName();
