const token = 'EAAPFLdeDwwgBSHsIIDpfo4HNaKncGDoGtgjHNTlFhVt92VRx6G3q0hGkpnRPd9gnB0FyfKOp4ZCkoJFboDSEf2o7b3FlU5BERQhTH2aEvdvVtPAmVejkOk0djXZCa5DYkO30AjMvGBWtYKj1BoqKUycvmZAp12PmlpLdsIttCeWRPKFoH1j2ZCcP7VoHpwZDZD';
const phoneNumberId = '1306213805899570';
const wabaId = '1314879630723797';

async function testMeta() {
    console.log('Testing Graph API for Cali...');

    // 1. Test Phone Info
    const phoneUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier&access_token=${token}`;
    const phoneRes = await fetch(phoneUrl);
    const phoneData = await phoneRes.json();
    console.log('Phone Info Response:', phoneRes.status, JSON.stringify(phoneData, null, 2));

    // 2. Test WABA Templates
    const tplUrl = `https://graph.facebook.com/v19.0/${wabaId}/message_templates?limit=100&access_token=${token}`;
    const tplRes = await fetch(tplUrl);
    const tplData = await tplRes.json();
    console.log('\nTemplates Response:', tplRes.status, JSON.stringify(tplData, null, 2));
}

testMeta();
