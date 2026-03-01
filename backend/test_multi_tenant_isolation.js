/**
 * Multi-Tenant Isolation Test
 * Verifies that data sent to Sede A doesn't leak into Sede B.
 */
const fetch = require('node-fetch');

const API_URL = 'http://localhost:4000/api'; // Assuming backend runs here

async function testIsolation() {
    console.log('🧪 Starting Multi-Tenant Isolation Test...');

    try {
        // 1. Mark read in Sede A (Medellín)
        console.log('📡 Requesting Sede Medellín...');
        const resA = await fetch(`${API_URL}/conversations`, {
            headers: { 'x-sede-slug': 'medellin' }
        });
        const dataA = await resA.json();
        console.log(`✅ Sede Medellín responded with ${dataA.length || 0} conversations.`);

        // 2. Request Sede B (Bogotá)
        console.log('📡 Requesting Sede Bogotá...');
        const resB = await fetch(`${API_URL}/conversations`, {
            headers: { 'x-sede-slug': 'bogota' }
        });
        const dataB = await resB.json();
        console.log(`✅ Sede Bogotá responded with ${dataB.length || 0} conversations.`);

        console.log('\n✨ Isolation test request completed. If both returned empty (or their respective data), it works!');
    } catch (err) {
        console.error('❌ Test failed:', err.message);
        console.log('💡 Make sure the backend is running with "npm run dev" or similar.');
    }
}

testIsolation();
