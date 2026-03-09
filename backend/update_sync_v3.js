require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function updateEvolutionSettings() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = 'large_sedeminutodios';

    console.log(`📡 Reconfigurando sincronización de historial para: ${instance}`);

    // Evolution v2 REQUIRES all properties for settings/set
    const settingsUrl = `${baseUrl}/settings/set/${instance}`;

    // This is the correct schema for Evolution v2 settings
    const body = {
        rejectCall: false,
        msgCall: "",
        groupsIgnore: false,
        alwaysOnline: true,
        readMessages: true,
        readStatus: false,
        syncHistory: true,
        syncFullHistory: true
    };

    try {
        console.log(`🚀 Enviando configuración completa a /settings/set/${instance}...`);
        const responseSet = await fetch(settingsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify(body)
        });

        const dataSet = await responseSet.json();
        console.log(`Respuesta Settings:`, JSON.stringify(dataSet, null, 2));

        if (responseSet.ok) {
            console.log('\n✅ ¡ÉXITO! Sincronización de historial activada.');
            console.log('📬 Evolution comenzará a traer los mensajes de los últimos 2 meses gradualmente.');
            console.log('💡 Tip: Dale un par de minutos a la instancia para que los procese.');
        } else {
            console.error('❌ Error final al actualizar:', dataSet);
        }
    } catch (e) {
        console.error('Error Crítico:', e.message);
    }
}

updateEvolutionSettings();
