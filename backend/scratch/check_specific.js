const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { Pool } = require('pg');

const dbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require';
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'distribuidores_ventas';

async function checkSpecific() {
    const rawPhone = '573114683297';
    const jid = `${rawPhone}@s.whatsapp.net`;
    const normalizedPhone = '+' + rawPhone;

    console.log(`🔍 Comparando Chat: ${normalizedPhone}`);

    // 1. Fetch from Evolution
    const evoRes = await fetch(`${BASE_URL}/chat/findMessages/${INSTANCE}`, {
        method: 'POST',
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 20 })
    });
    const evoData = await evoRes.json();
    const evoMsgs = Array.isArray(evoData) ? evoData : (evoData.messages?.records || evoData.records || []);

    console.log(`📡 Evolution tiene ${evoMsgs.length} mensajes recientes.`);

    // 2. Fetch from DB
    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    const { rows: dbMsgs } = await pool.query(`
        SELECT text_content, whatsapp_id, timestamp 
        FROM messages 
        WHERE conversation_phone = $1 OR conversation_phone = $2
        ORDER BY timestamp DESC LIMIT 20
    `, [normalizedPhone, rawPhone]);

    console.log(`📊 DB local tiene ${dbMsgs.length} mensajes recientes.`);

    const dbIds = new Set(dbMsgs.map(m => m.whatsapp_id));

    // 3. Compare
    console.log('\n--- Análisis de Diferencias ---');
    let missingEvo = 0;
    for (const msg of evoMsgs) {
        const id = msg.key?.id;
        if (!dbIds.has(id)) {
            let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || 'Multimedia/Otros';
            console.log(`❌ Faltante en DB: [ID: ${id}] "${text.substring(0, 50)}..." @ ${new Date(msg.messageTimestamp * 1000).toLocaleString()}`);
            missingEvo++;
        }
    }

    if (missingEvo === 0) {
        console.log('✅ Todo al día: Todos los mensajes de Evolution están en tu DB.');
    } else {
        console.log(`\n⚠️ Faltan ${missingEvo} mensajes en la base de datos.`);
    }

    await pool.end();
}

checkSpecific().catch(console.error);
