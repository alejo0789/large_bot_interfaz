const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function sendTestMessage() {
    const baseUrl = 'https://evolution-api-production-8e62.up.railway.app';
    const apiKey = 'hash_12345';
    const instance = 'large_cali';
    const jid = '120363422096835125@g.us';

    try {
        console.log(`Sending test message to ${jid}...`);
        const response = await fetch(`${baseUrl}/message/sendText/${instance}`, {
            method: 'POST',
            headers: { 
                'apikey': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: jid,
                text: "🤖 Test de conexión desde el sistema central.",
                delay: 1200
            })
        });
        
        const data = await response.json();
        console.log('Response:', data);
    } catch (err) {
        console.error(err);
    }
}

sendTestMessage();
