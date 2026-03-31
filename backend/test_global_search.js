const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testGlobalSearch() {
    const baseUrl = 'https://evolution-api-production-8e62.up.railway.app';
    const apiKey = 'hash_12345';
    const inst = 'distribuidores_ventas';
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - (20 * 24 * 60 * 60);

    const url = `${baseUrl}/chat/findMessages/${inst}`;
    console.log(`📡 Probando búsqueda global de mensajes en ${url}...`);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                where: {
                    messageTimestamp: { gte: cutoffTimestamp }
                },
                limit: 100
            })
        });

        const data = await res.json();
        const records = Array.isArray(data) ? data : (data.messages?.records || data.records || []);
        console.log(`✅  Se recibieron ${records.length} mensajes en la búsqueda global.`);
        if (records.length > 0) {
            console.log(`Ejemplo (ID): ${records[0].key?.id}`);
            console.log(`Ejemplo (JID): ${records[0].key?.remoteJid}`);
        }
    } catch (e) {
        console.error(e);
    }
}

testGlobalSearch();
