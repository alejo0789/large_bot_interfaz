require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function updateEvolutionSync() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = 'large_sedeminutodios';

    console.log(`📡 Actualizando configuración de sincronización para: ${instance}`);

    // Endpoint para actualizar configuraciones de la instancia en Evolution v2
    const url = `${baseUrl}/instance/settings/${instance}`;

    const body = {
        syncFullHistory: true,
        shouldSyncHistory: true,
        // En Evolution v2, a veces estas configuraciones finales se mandan así:
        rejectCall: false,
        msgCall: "",
        groupsIgnore: false,
        alwaysOnline: true,
        readMessages: true,
        readStatus: false,
        syncHistory: true
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (response.ok) {
            console.log('✅ Configuración actualizada con éxito:', JSON.stringify(data, null, 2));
            console.log('\n🚀 Iniciando sincronización manual de chats...');

            // Forzamos un fetch de chats para que Evolution empiece a procesar la lista
            const fetchUrl = `${baseUrl}/chat/findChats/${instance}`;
            await fetch(fetchUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({})
            });

            console.log('📬 Evolution ha sido notificado. Los mensajes de los últimos 2 meses empezarán a aparecer en tu bot gradualmente.');
        } else {
            console.error('❌ Error al actualizar:', data);
        }
    } catch (error) {
        console.error('❌ Error crítico:', error.message);
    }
}

updateEvolutionSync();
