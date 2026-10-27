const axios = require('axios');

const APP_ID = '7698285224907505684';
const SECRET = '08e85aa6586c4ce4cfd11db2ce1816b8c741991d';

async function updateWebhook(callbackUrl) {
    if (!callbackUrl) {
        console.error('❌ Debes proporcionar la URL del callback.');
        console.log('Uso: node scripts/tiktok_webhook_subscribe.js <CALLBACK_URL>');
        process.exit(1);
    }

    console.log(`\n🔄 Registrando Webhook en TikTok Business API...`);
    console.log(`App ID: ${APP_ID}`);
    console.log(`Callback URL: ${callbackUrl}`);
    console.log(`Event Type: DIRECT_MESSAGE`);

    try {
        const response = await axios.post('https://business-api.tiktok.com/open_api/v1.3/business/webhook/update/', {
            app_id: APP_ID,
            secret: SECRET,
            event_type: 'DIRECT_MESSAGE',
            callback_url: callbackUrl
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('\n📥 Respuesta de TikTok:');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.code === 0) {
            console.log('\n✅ ¡Webhook registrado exitosamente en TikTok!');
        } else {
            console.error('\n❌ Error al registrar webhook:', response.data.message);
        }
    } catch (err) {
        console.error('\n❌ Error en la petición a TikTok:');
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        } else {
            console.error(err.message);
        }
    }
}

const url = process.argv[2];
updateWebhook(url);
