require('dotenv').config();
const axios = require('axios');

const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = 'large_ciudadmontes';

async function main() {
    const testLid = '271807122767902@lid';
    console.log(`📡 Querying whatsappNumbers for instance: ${INSTANCE}`);
    console.log(`📡 URL: ${EVOLUTION_BASE_URL}/chat/whatsappNumbers/${INSTANCE}`);
    try {
        const res = await axios.post(`${EVOLUTION_BASE_URL}/chat/whatsappNumbers/${INSTANCE}`, {
            numbers: [testLid]
        }, {
            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY }
        });
        console.log("Response data:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
}

main().catch(console.error);
