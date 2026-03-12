require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function check() {
    const baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = 'large_sedeminutodios';
    const target = '573192569425@s.whatsapp.net';

    console.log(`🔍 Buscando chats de Evolution para: ${target}`);

    // Buscar en findChats
    const chatsRes = await fetch(`${baseUrl}/chat/findChats/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
        body: JSON.stringify({})
    });
    const chats = await chatsRes.json();
    const list = Array.isArray(chats) ? chats : (chats.chats || chats.data || []);

    // Buscar este número
    const found = list.filter(c => {
        const jid = c.id || c.remoteJid || '';
        return jid.includes('573192569425') || jid.includes('192569425');
    });

    if (found.length > 0) {
        console.log(`\n✅ Chat encontrado en Evolution:`);
        found.forEach(c => console.log(JSON.stringify(c, null, 2)));
    } else {
        console.log(`\n❌ NO se encontró chat para ${target} en Evolution`);
    }

    // También buscar mensajes directamente
    console.log(`\n📩 Buscando mensajes directamente...`);
    const msgsRes = await fetch(`${baseUrl}/chat/findMessages/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
        body: JSON.stringify({
            where: { key: { remoteJid: target } },
            limit: 5
        })
    });
    const msgsData = await msgsRes.json();
    const msgs = Array.isArray(msgsData) ? msgsData : (msgsData.messages?.records || msgsData.records || msgsData.data || []);
    console.log(`📥 Mensajes encontrados: ${msgs.length}`);
    if (msgs.length > 0) console.log('Primer msg:', JSON.stringify(msgs[0], null, 2));
}
check().catch(console.error);
