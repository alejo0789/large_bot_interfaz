/**
 * Evolution API Diagnostic & Fix Script
 * Run with: node fix-evolution.js [API_KEY_TO_TRY]
 *
 * Usage:
 *   node fix-evolution.js                     → use key from .env
 *   node fix-evolution.js TuApiKeyReal        → test with a specific key
 *   node fix-evolution.js TuApiKeyReal --fix  → also re-register webhook
 */

require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-8e62.up.railway.app';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'large_cali';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://largebotinterfaz-production-5b38.up.railway.app/evolution';

// Accept key from CLI arg or .env
const API_KEY = process.argv[2]?.startsWith('--') ? (process.env.EVOLUTION_API_KEY || 'hash_12345') : (process.argv[2] || process.env.EVOLUTION_API_KEY || 'hash_12345');
const SHOULD_FIX = process.argv.includes('--fix');

const headers = { 'Content-Type': 'application/json', 'apikey': API_KEY };

async function req(method, path, body) {
    const url = `${EVOLUTION_URL}${path}`;
    console.log(`\n📡 ${method} ${url}`);
    try {
        const res = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }
        console.log(`   Status: ${res.status}`);
        console.log(`   Body:`, JSON.stringify(data, null, 2));
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        console.error(`   ❌ Network error: ${err.message}`);
        return { ok: false, status: 0, data: null };
    }
}

async function main() {
    console.log('═'.repeat(60));
    console.log('🔍  Evolution API Diagnostics');
    console.log('═'.repeat(60));
    console.log(`  URL:      ${EVOLUTION_URL}`);
    console.log(`  Instance: ${INSTANCE}`);
    console.log(`  API Key:  ${API_KEY}`);
    console.log(`  Webhook:  ${WEBHOOK_URL}`);
    console.log(`  Fix Mode: ${SHOULD_FIX ? 'YES (will re-register webhook)' : 'NO (dry run)'}`);
    console.log('═'.repeat(60));

    // ── 1. Check API key (list instances) ────────────────────────────
    console.log('\n[1/4] Checking API key with /instance/fetchInstances...');
    const instances = await req('GET', '/instance/fetchInstances');

    if (instances.status === 401) {
        console.log('\n🔴 API KEY IS WRONG or missing!');
        console.log('   → Go to your Evolution API manager (Railway/server)');
        console.log('   → Find the AUTHENTICATION_API_KEY environment variable');
        console.log('   → Update EVOLUTION_API_KEY in your backend .env');
        console.log('   → Re-run: node fix-evolution.js YOUR_REAL_KEY --fix');
        process.exit(1);
    } else if (instances.ok) {
        console.log('\n✅ API key is VALID!');
    }

    // ── 2. Check instance connection state ───────────────────────────
    console.log('\n[2/4] Checking instance connection state...');
    const state = await req('GET', `/instance/connectionState/${INSTANCE}`);

    if (!state.ok) {
        console.log('\n🔴 Instance not found or error. Available instances:');
        if (Array.isArray(instances.data)) {
            instances.data.forEach(i => console.log(`   - ${i.name || i.instance?.instanceName}`));
        }
    } else {
        const connectionState = state.data?.instance?.state || state.data?.state;
        const isConnected = connectionState === 'open';
        console.log(`\n${isConnected ? '✅' : '🟡'} Instance state: ${connectionState}`);
        if (!isConnected) {
            console.log('   → Instance is NOT connected to WhatsApp!');
            console.log('   → Open Evolution Manager and scan the QR code for large_cali');
        }
    }

    // ── 3. Check current webhook config ──────────────────────────────
    console.log('\n[3/4] Checking current webhook configuration...');
    const webhook = await req('GET', `/webhook/find/${INSTANCE}`);

    if (webhook.ok) {
        const wh = webhook.data;
        const currentUrl = wh?.url || wh?.webhook?.url || 'none';
        const isEnabled = wh?.enabled ?? wh?.webhook?.enabled ?? false;
        console.log(`\n   Current webhook URL: ${currentUrl}`);
        console.log(`   Enabled: ${isEnabled}`);
        console.log(`   Expected: ${WEBHOOK_URL}`);

        if (currentUrl !== WEBHOOK_URL) {
            console.log('\n⚠️  WEBHOOK URL IS WRONG! This is why messages don\'t arrive.');
        } else if (!isEnabled) {
            console.log('\n⚠️  WEBHOOK IS DISABLED! Messages won\'t arrive.');
        } else {
            console.log('\n✅ Webhook looks correct. Issue might be elsewhere.');
        }
    }

    // ── 4. Re-register webhook if --fix ──────────────────────────────
    if (SHOULD_FIX) {
        console.log('\n[4/4] Re-registering webhook...');
        const result = await req('PUT', `/webhook/set/${INSTANCE}`, {
            url: WEBHOOK_URL,
            enabled: true,
            webhook_by_events: false,
            webhook_base64: false,
            events: [
                'APPLICATION_STARTUP',
                'QRCODE_UPDATED',
                'MESSAGES_SET',
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'MESSAGES_DELETE',
                'SEND_MESSAGE',
                'CONTACTS_SET',
                'CONTACTS_UPSERT',
                'CONTACTS_UPDATE',
                'PRESENCE_UPDATE',
                'CHATS_SET',
                'CHATS_UPSERT',
                'CHATS_UPDATE',
                'CHATS_DELETE',
                'GROUPS_UPSERT',
                'GROUP_UPDATE',
                'GROUP_PARTICIPANTS_UPDATE',
                'CONNECTION_UPDATE',
                'CALL',
                'NEW_JWT_TOKEN'
            ]
        });

        if (result.ok) {
            console.log('\n✅ Webhook re-registered successfully!');
            console.log('   → Messages should now arrive at your backend');
            console.log('   → Send a test WhatsApp message to verify');
        } else {
            console.log('\n🔴 Failed to set webhook. Check the response above.');
            // Try POST as fallback
            console.log('   Trying POST instead of PUT...');
            await req('POST', `/webhook/set/${INSTANCE}`, {
                url: WEBHOOK_URL,
                enabled: true,
                events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'SEND_MESSAGE']
            });
        }
    } else {
        console.log('\n[4/4] Skipping webhook fix (add --fix to apply)');
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📋  SUMMARY & NEXT STEPS:');
    console.log('═'.repeat(60));
    console.log('1. If API key was wrong: update EVOLUTION_API_KEY in backend/.env');
    console.log('   Then restart with: node fix-evolution.js YOUR_KEY --fix');
    console.log('');
    console.log('2. If webhook was wrong: already fixed with --fix flag');
    console.log('   Verify by sending a WhatsApp message and checking backend logs');
    console.log('');
    console.log('3. If instance was disconnected: go to Evolution Manager and reconnect');
    console.log('');
    console.log('4. To verify webhook is working after fix:');
    console.log(`   curl -X GET ${EVOLUTION_URL}/webhook/find/${INSTANCE} -H "apikey: ${API_KEY}"`);
    console.log('═'.repeat(60));
}

main().catch(console.error);
