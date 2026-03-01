
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const instance = 'large_alejo_wp2';
const apiKey = 'hash_12345';
const baseUrl = 'https://evolution-api-production-8e62.up.railway.app';
const webhookUrl = 'https://largebotinterfaz-production-5b38.up.railway.app/evolution';

async function fixWebhook() {
    console.log(`📡 Setting webhook for ${instance}...`);
    const url = `${baseUrl}/webhook/set/${instance}`;

    const body = {
        "webhook": {
            "url": webhookUrl,
            "enabled": true,
            "webhookByEvents": false,
            "webhookBase64": true,
            "events": [
                'APPLICATION_STARTUP',
                'QRCODE_UPDATED',
                'MESSAGES_SET',
                'MESSAGES_UPSERT',
                'MESSAGES_EDITED',
                'MESSAGES_UPDATE',
                'MESSAGES_DELETE',
                'SEND_MESSAGE',
                'CONTACTS_SET',
                'CONTACTS_UPSERT',
                'CONTACTS_UPDATE',
                'CHATS_SET',
                'CHATS_UPSERT',
                'CHATS_UPDATE',
                'CHATS_DELETE',
                'GROUPS_UPSERT',
                'GROUP_UPDATE',
                'CONNECTION_UPDATE',
                'CALL'
            ]
        }
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        console.log('✅ Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

fixWebhook();
