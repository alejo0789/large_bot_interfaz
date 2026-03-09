require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function forceSync() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = 'large_sedeminutodios';

    console.log(`🚀 Forzando sincronización de historial para: ${instance}`);

    try {
        // 1. Asegurar configuración de sync
        await fetch(`${baseUrl}/settings/set/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({
                syncHistory: true,
                syncFullHistory: true,
                shouldSyncHistory: true
            })
        });

        // 2. Disparar findChats (esto suele disparar el webhook CHATS_SET)
        console.log(`📋 Disparando /chat/findChats...`);
        const resChats = await fetch(`${baseUrl}/chat/findChats/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({})
        });

        console.log(`Estado findChats: ${resChats.status}`);

        // 3. Opcional: findMessages para disparar MESSAGES_SET
        console.log(`📩 Disparando /chat/findMessages (esto forzará el envío de historial al webhook)...`);
        await fetch(`${baseUrl}/chat/findMessages/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({
                where: {},
                limit: 100
            })
        });

        console.log('\n✅ Peticiones de sincronización enviadas.');
        console.log('⏳ Revisa el bot en unos minutos. El backend ahora está preparado para recibir y guardar lotes de mensajes antiguos.');
    } catch (error) {
        console.error('❌ Error forzando sync:', error.message);
    }
}

// Esperamos 30 segundos antes de ejecutar para dejar que Railway termine el deploy
console.log('⏳ Esperando 30s a que Railway termine el despliegue...');
setTimeout(forceSync, 30000);
