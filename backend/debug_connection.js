require('dotenv').config();
const evolutionService = require('./src/services/evolutionService');
const { config } = require('./src/config/app');

async function debugConnection() {
    console.log('🔍 Checking Evolution API Connection...');
    console.log('Base URL:', config.evolutionApiUrl);
    console.log('Instance:', config.evolutionInstance);

    try {
        const state = await evolutionService.checkInstance();
        console.log('📡 Connection State Result:', JSON.stringify(state, null, 2));

        if (state.instance && state.instance.state === 'open') {
            console.log('✅ Instance is OPEN and connected.');
        } else {
            console.log('❌ Instance is NOT connected. Current state:', state.instance ? state.instance.state : 'UNKNOWN');
            console.log('⚠️ Please open your Evolution API Manager and re-link the WhatsApp account.');
        }
    } catch (error) {
        console.error('❌ Error checking connection:', error.message);
    }
}

debugConnection();
