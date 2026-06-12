require('dotenv').config();
const axios = require('axios');

const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = 'large_ciudadmontes';

async function main() {
    const testLid = '271807122767902@lid';
    console.log(`📡 Fetching messages for LID: ${testLid}`);
    try {
        const res = await axios.post(`${EVOLUTION_BASE_URL}/chat/findMessages/${INSTANCE}`, {
            where: { key: { remoteJid: testLid } },
            limit: 5
        }, {
            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY }
        });
        const messages = res.data;
        const records = Array.isArray(messages) ? messages : (messages.messages?.records || messages.records || messages.data || []);
        console.log("Response records length:", records.length);
        if (records.length > 0) {
            console.log("First message structure:", JSON.stringify(records[0], null, 2));
        }
    } catch (e) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
}

main().catch(console.error);
