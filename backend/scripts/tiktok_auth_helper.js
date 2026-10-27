const axios = require('axios');
const fs = require('fs');
const path = require('path');

const APP_ID = '7698285224907505684';
const SECRET = '08e85aa6586c4ce4cfd11db2ce1816b8c741991d';
const REDIRECT_URI = 'https://verificador.movaiti.com/';

const TOKEN_FILE = path.join(__dirname, '../tiktok_token.json');

async function exchangeAuthCode(authCode) {
    console.log(`\n🔄 Canjeando auth_code por access_token en TikTok...`);
    console.log(`App ID: ${APP_ID}`);
    console.log(`Auth Code: ${authCode}`);

    try {
        const response = await axios.post('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
            app_id: APP_ID,
            secret: SECRET,
            auth_code: authCode
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('\n📥 Respuesta de TikTok:');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.code === 0 && response.data.data) {
            fs.writeFileSync(TOKEN_FILE, JSON.stringify(response.data.data, null, 2));
            console.log(`\n✅ ¡Token obtenido y guardado exitosamente en: ${TOKEN_FILE}!`);
            console.log(`Access Token: ${response.data.data.access_token}`);
            if (response.data.data.advertiser_ids) {
                console.log(`Cuentas asociadas:`, response.data.data.advertiser_ids);
            }
        } else {
            console.error('\n❌ Error devuelto por TikTok:', response.data.message);
        }
    } catch (err) {
        console.error('\n❌ Error al conectar con TikTok API:');
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        } else {
            console.error(err.message);
        }
    }
}

async function checkUserInfo() {
    if (!fs.existsSync(TOKEN_FILE)) {
        console.log('⚠️ No hay token guardado. Primero canjea el auth_code.');
        return;
    }
    const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
    console.log(`Token guardado: ${tokenData.access_token?.substring(0, 10)}...`);

    try {
        console.log('Consultando información del usuario/negocio en TikTok...');
        const res = await axios.get('https://business-api.tiktok.com/open_api/v1.3/user/info/', {
            headers: {
                'Access-Token': tokenData.access_token
            }
        });
        console.log('Info de Usuario:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        if (err.response) {
            console.error('Error info:', err.response.status, err.response.data);
        } else {
            console.error('Error:', err.message);
        }
    }
}

const args = process.argv.slice(2);
const command = args[0];

if (command === 'exchange') {
    const code = args[1];
    if (!code) {
        console.log('Uso: node scripts/tiktok_auth_helper.js exchange <AUTH_CODE>');
        process.exit(1);
    }
    exchangeAuthCode(code);
} else if (command === 'info') {
    checkUserInfo();
} else {
    console.log('==============================================');
    console.log('   TIKTOK OAUTH & TOKEN HELPER');
    console.log('==============================================');
    console.log('1. Abre esta URL en tu navegador:');
    console.log(`https://business-api.tiktok.com/portal/auth?app_id=${APP_ID}&state=forsa_tiktok&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`);
    console.log('\n2. Autoriza el acceso con tu cuenta de TikTok.');
    console.log('\n3. Te redirigirá a verificador.movaiti.com/?auth_code=XXXXXX&state=forsa_tiktok');
    console.log('   Copia el valor de "auth_code" de la barra de direcciones.');
    console.log('\n4. Ejecuta:');
    console.log('   node scripts/tiktok_auth_helper.js exchange <TU_AUTH_CODE>');
    console.log('==============================================');
}
