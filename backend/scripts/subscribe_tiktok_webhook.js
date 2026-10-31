require('dotenv').config();

const axios = require('axios');

const appId = process.env.TIKTOK_APP_ID;
const appSecret = process.env.TIKTOK_APP_SECRET;
const configuredCallback = process.env.TIKTOK_WEBHOOK_CALLBACK_URL;
const callbackUrl = configuredCallback || (process.env.TIKTOK_REDIRECT_URI
    ? new URL('/webhook/tiktok', process.env.TIKTOK_REDIRECT_URI).toString()
    : '');

if (!appId || !appSecret || !callbackUrl) {
    console.error('Missing TIKTOK_APP_ID, TIKTOK_APP_SECRET, or TikTok webhook callback configuration.');
    process.exit(1);
}

if (!callbackUrl.startsWith('https://')) {
    console.error('TIKTOK_WEBHOOK_CALLBACK_URL must use HTTPS.');
    process.exit(1);
}

async function subscribe() {
    try {
        const response = await axios.post(
            'https://business-api.tiktok.com/open_api/v1.3/business/webhook/update/',
            {
                app_id: appId,
                secret: appSecret,
                event_type: 'DIRECT_MESSAGE',
                callback_url: callbackUrl
            },
            { headers: { 'Content-Type': 'application/json' }, timeout: 20000 }
        );
        const data = response.data || {};
        console.log(JSON.stringify({
            httpStatus: response.status,
            code: data.code,
            message: data.message,
            requestId: data.request_id,
            subscription: data.data
        }, null, 2));
        if (data.code !== 0) process.exitCode = 1;
    } catch (error) {
        const data = error.response?.data;
        console.error(JSON.stringify({
            httpStatus: error.response?.status || null,
            code: data?.code,
            message: data?.message || error.message,
            requestId: data?.request_id
        }, null, 2));
        process.exitCode = 1;
    }
}

subscribe();
