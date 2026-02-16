const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

const config = {
    evolutionApiUrl: process.env.EVOLUTION_API_URL,
    evolutionApiKey: process.env.EVOLUTION_API_KEY,
    evolutionInstance: process.env.EVOLUTION_INSTANCE
};

async function testConnection() {
    console.log('🧪 Probando conexión con Evolution API...');
    console.log(`🔗 URL: ${config.evolutionApiUrl}`);
    console.log(`🆔 Instancia: ${config.evolutionInstance}`);
    console.log(`🔑 Key (snippet): ${config.evolutionApiKey?.substring(0, 5)}...`);

    try {
        const url = `${config.evolutionApiUrl}/instance/connectionState/${config.evolutionInstance}`;
        const response = await fetch(url, {
            headers: { 'apikey': config.evolutionApiKey }
        });

        const data = await response.json();
        console.log('📡 Respuesta de la API:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('✅ Conexión técnica exitosa.');
            if (data.instance?.state === 'open' || data.state === 'open') {
                console.log('📱 WhatsApp está CONECTADO y listo.');
            } else {
                console.warn('⚠️ La instancia existe pero WhatsApp NO está vinculado (scan QR needed).');
            }
        } else {
            console.error('❌ Error de autenticación o instancia no encontrada.');
        }
    } catch (error) {
        console.error('❌ Error fatal al conectar:', error.message);
    }
}

testConnection();
