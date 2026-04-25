const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testWebhook() {
    const url = 'https://largebotinterfaz-production-5b38.up.railway.app/evolution';
    const body = {
        event: 'messages.upsert',
        instance: 'large_cali',
        data: {
            key: {
                remoteJid: '120363422096835125@g.us',
                fromMe: false,
                id: 'TEST_MSG_' + Date.now()
            },
            pushName: 'Tester',
            message: {
                conversation: '🤖 Webhook test for group'
            },
            messageTimestamp: Math.floor(Date.now() / 1000)
        }
    };

    try {
        console.log(`Sending test webhook to ${url}...`);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response:', text);
    } catch (err) {
        console.error(err);
    }
}

testWebhook();
