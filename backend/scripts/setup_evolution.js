/**
 * Setup Evolution API
 * Checks status and creates instance if needed
 */
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const API_KEY = process.env.EVOLUTION_API_KEY || '12345';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'chatbot';

async function main() {
    console.log('🚀 Checking Evolution API Connection...');
    console.log(`📡 URL: ${BASE_URL}`);

    // 1. Check if Evolution is Up
    try {
        await fetch(BASE_URL);
    } catch (e) {
        console.error('❌ Cannot connect to Evolution API. Is it running?');
        console.error('   Run: docker-compose up -d in "evolution api" folder');
        process.exit(1);
    }

    console.log('✅ Evolution API is accessible');

    // 2. Check Instance
    console.log(`🔍 Checking instance: ${INSTANCE}`);
    const checkUrl = `${BASE_URL}/instance/connectionState/${INSTANCE}`;

    try {
        const checkRes = await fetch(checkUrl, {
            headers: { 'apikey': API_KEY }
        });

        const checkData = await checkRes.json();

        if (checkRes.ok) {
            console.log(`✅ Instance '${INSTANCE}' exists.`);
            console.log(`Status: ${checkData.instance?.state || JSON.stringify(checkData)}`);

            if (checkData.instance?.state === 'open') {
                console.log('🟢 INSTANCE IS CONNECTED!');
                await setWebhook();
            } else {
                console.log('⚠️ Instance not connected. Fetching QR Code details...');
                await connectInstance();
            }
        } else {
            if (checkData.status === 404 || checkData.error === 'Instance not found') {
                console.log(`⚠️ Instance '${INSTANCE}' not found. Creating...`);
                await createInstance();
            } else {
                console.error('❌ Error checking instance:', checkData);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function setWebhook() {
    console.log('🔗 Configuring Webhook...');
    const url = `${BASE_URL}/webhook/set/${INSTANCE}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': API_KEY
            },
            body: JSON.stringify({
                webhook: {
                    url: 'http://host.docker.internal:4000/evolution',
                    enabled: true,
                    events: ['MESSAGES_UPSERT'],
                    groups: true
                }
            })
        });
        const data = await res.json();
        console.log('✅ Webhook configured:', JSON.stringify(data));
    } catch (error) {
        console.error('❌ Error setting webhook:', error);
    }
}

async function createInstance() {
    const url = `${BASE_URL}/instance/create`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': API_KEY
            },
            body: JSON.stringify({
                instanceName: INSTANCE,
                token: 'secret_token_123',
                qrcode: true,
                integration: 'WHATSAPP-BAILEYS',
            })
        });

        const data = await res.json();
        console.log('✨ Instance Creation/Connect Result:', JSON.stringify(data, null, 2));

        if (data.qrcode) {
            console.log('📷 QR CODE DATA received (base64). View it in frontend or logs.');
        }

    } catch (error) {
        console.error('❌ Error creating instance:', error);
    }
}

async function connectInstance() {
    const url = `${BASE_URL}/instance/connect/${INSTANCE}`;
    try {
        const res = await fetch(url, {
            headers: { 'apikey': API_KEY }
        });
        const data = await res.json();
        console.log('🔗 Connection info:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Error connecting:', error);
    }
}

main();
