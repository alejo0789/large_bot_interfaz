const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

const TARGET_PHONE = '573187999686';

async function checkProfile() {
    console.log(`🔍 Checking profile for ${TARGET_PHONE}...`);

    try {
        const response = await fetch(`${BASE_URL}/chat/profile/${INSTANCE}?number=${TARGET_PHONE}`, {
            method: 'GET',
            headers: { 'apikey': API_KEY }
        });
        const data = await response.json();
        console.log('Profile Data:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(err);
    }
}

checkProfile();
