const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

const TARGET_PHONE = '573187999686@s.whatsapp.net';

async function checkAllPossibleFields() {
    console.log(`🔍 Checking all fields for ${TARGET_PHONE}...`);

    try {
        const response = await fetch(`${BASE_URL}/chat/findContacts/${INSTANCE}`, {
            method: 'POST',
            headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ where: { remoteJid: TARGET_PHONE } })
        });
        const data = await response.json();

        if (data && data.length > 0) {
            const contact = data[0];
            console.log('--- ALL CONTACT FIELDS ---');
            Object.keys(contact).forEach(key => {
                console.log(`${key}: ${JSON.stringify(contact[key])}`);
            });
        } else {
            console.log('Contact not found.');
        }
    } catch (err) {
        console.error(err);
    }
}

checkAllPossibleFields();
