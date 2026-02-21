/**
 * Evolution Reconnect Script
 * Fuerza reconexión de la instancia large_cali
 * Run: node reconnect-evolution.js
 */
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE = 'https://evolution-api-production-8e62.up.railway.app';
const KEY = 'hash_12345';
const INST = 'large_cali';

const h = { 'Content-Type': 'application/json', 'apikey': KEY };

async function main() {
    console.log('═'.repeat(55));
    console.log('🔄  Evolution Reconnect — Instance:', INST);
    console.log('═'.repeat(55));

    // ── 1. Check current real state ───────────────────────
    console.log('\n[1] Checking real connection state...');
    const stateRes = await fetch(`${BASE}/instance/connectionState/${INST}`, { headers: h });
    const stateData = await stateRes.json();
    console.log('  State:', JSON.stringify(stateData));

    const state = stateData?.instance?.state;
    console.log('\n  → Reported state:', state);

    if (state === 'open') {
        console.log('  ⚠️  Evolution says "open" but disconnectionObject shows a conflict.');
        console.log('  → This is a stale session. Will force restart...');
    }

    // ── 2. Restart the instance (soft restart, keeps session) ──
    console.log('\n[2] Restarting instance (soft reconnect)...');
    const restartRes = await fetch(`${BASE}/instance/restart/${INST}`, {
        method: 'PUT',
        headers: h
    });
    const restartData = await restartRes.text();
    console.log('  Restart status:', restartRes.status, restartData);

    await new Promise(r => setTimeout(r, 3000));

    // ── 3. Check state after restart ─────────────────────────
    console.log('\n[3] Checking state after restart...');
    const state2Res = await fetch(`${BASE}/instance/connectionState/${INST}`, { headers: h });
    const state2Data = await state2Res.json();
    const newState = state2Data?.instance?.state;
    console.log('  New state:', newState);

    if (newState === 'open') {
        console.log('\n✅ Instance reconnected successfully!');
        console.log('   → Messages should now flow through the webhook');
        console.log('   → Try sending a WhatsApp message to verify');
    } else {
        // ── 4. Try full logout + reconnect as fallback ────────
        console.log('\n[4] Soft restart failed. Trying logout + reconnect...');

        const logoutRes = await fetch(`${BASE}/instance/logout/${INST}`, {
            method: 'DELETE',
            headers: h
        });
        console.log('  Logout:', logoutRes.status);

        await new Promise(r => setTimeout(r, 2000));

        const connectRes = await fetch(`${BASE}/instance/connect/${INST}`, {
            method: 'GET',
            headers: h
        });
        const connectData = await connectRes.json();
        console.log('  Connect response:', JSON.stringify(connectData, null, 2));

        if (connectData.code || connectData.base64 || connectData.qrcode) {
            console.log('\n📱 QR CODE REQUIRED!');
            console.log('   → Open Evolution Manager in browser');
            console.log(`   → Go to: ${BASE}`);
            console.log('   → Find instance "large_cali" and scan the QR code');
        }
    }

    // ── 5. Test webhook manually ──────────────────────────────
    console.log('\n[5] Sending test ping to webhook...');
    const webhookUrl = 'https://largebotinterfaz-production-5b38.up.railway.app/evolution';
    try {
        const pingRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'CONNECTION_UPDATE',
                instance: INST,
                data: { state: 'open', _diagnostic: true }
            })
        });
        console.log('  Webhook ping status:', pingRes.status, pingRes.ok ? '✅' : '❌');
    } catch (e) {
        console.log('  Webhook ping failed:', e.message);
    }

    console.log('\n' + '═'.repeat(55));
    console.log('💡  If still not working:');
    console.log('   1. Open Evolution Manager UI and check the instance');
    console.log('   2. Check Railway logs for largebotinterfaz-production');
    console.log('   3. Look for webhook delivery errors in Evolution logs');
    console.log('═'.repeat(55));
}

main().catch(console.error);
