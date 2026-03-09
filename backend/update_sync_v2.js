require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function updateEvolutionSettings() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = 'large_sedeminutodios';

    console.log(`📡 Reconfigurando sincronización de historial para: ${instance}`);

    // Probar las dos estructuras comunes en Evolution v2 para configuraciones
    const settingsUrl = `${baseUrl}/settings/set/${instance}`;
    const syncUrl = `${baseUrl}/chat/sync/${instance}`; // Endpoint for syncing history explicitly

    const body = {
        syncFullHistory: true,
        shouldSyncHistory: true,
        presence: "available",
        groupsIgnore: false,
        readMessages: true,
        readStatus: true
    };

    try {
        console.log(`🚀 Intentando PUT /settings/set/${instance}...`);
        const responseSet = await fetch(settingsUrl, {
            method: 'POST', // Evolution use POST or PUT for settings depending on version
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify(body)
        });

        const dataSet = await responseSet.json();
        console.log(`Respuesta Settings:`, JSON.stringify(dataSet, null, 2));

        if (responseSet.ok) {
            console.log('✅ Sincronización habilitada.');

            // Trigger actual sync
            console.log('📬 Disparando sincronización manual...');
            const syncRes = await fetch(`${baseUrl}/chat/findChats/${instance}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({})
            });
            console.log('Estado Sincronización:', syncRes.status);
        } else {
            console.warn('⚠️ No se pudo actualizar vía settings/set, probando ruta alternativa...');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

updateEvolutionSettings();
