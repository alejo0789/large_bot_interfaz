const token = 'EAAPFLdeDwwgBSHsIIDpfo4HNaKncGDoGtgjHNTlFhVt92VRx6G3q0hGkpnRPd9gnB0FyfKOp4ZCkoJFboDSEf2o7b3FlU5BERQhTH2aEvdvVtPAmVejkOk0djXZCa5DYkO30AjMvGBWtYKj1BoqKUycvmZAp12PmlpLdsIttCeWRPKFoH1j2ZCcP7VoHpwZDZD';
const phoneNumberId = '1306213805899570';

async function sendSpanishTemplate() {
    console.log('Sending prueba_boton template to 573153404327...');

    const apiUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    const body = {
        messaging_product: 'whatsapp',
        to: '573153404327',
        type: 'template',
        template: {
            name: 'prueba_boton',
            language: { code: 'es' }
        }
    };

    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));
}

sendSpanishTemplate();
