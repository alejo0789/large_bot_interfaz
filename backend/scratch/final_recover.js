const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { Pool } = require('pg');

const dbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require';
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'distribuidores_ventas';

function normalizePhone(phone) {
    if (!phone) return null;
    let phoneStr = String(phone);
    if (phoneStr.includes('@g.us') || phoneStr.includes('-')) return phoneStr;
    let cleanPart = phoneStr.includes('@') ? phoneStr.split('@')[0] : phoneStr;
    let digits = cleanPart.replace(/\D/g, '');
    if (phoneStr.includes('@lid') || digits.length > 13) {
        return phoneStr.includes('@') ? phoneStr : `${digits}@lid`;
    }
    if (digits.startsWith('573') && digits.length === 12) return '+' + digits;
    if (digits.startsWith('3') && digits.length === 10) return '+57' + digits;
    if (digits.length >= 10 && digits.length <= 13) return `+${digits}`;
    return null;
}

async function recover() {
    console.log('🚀 Iniciando recuperación definitiva...');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 2);
    cutoffDate.setHours(0,0,0,0);
    const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);

    console.log(`🔍 Buscando chats activos desde: ${cutoffDate.toISOString()}...`);

    const chatRes = await fetch(`${BASE_URL}/chat/findChats/${INSTANCE}`, {
        method: 'POST',
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ where: {}, limit: 500 })
    });
    const chats = await chatRes.json();
    
    // FILTRO CRÍTICO: Usar remoteJid y updatedAt
    const activeTodayEvo = chats.filter(c => c.updatedAt && new Date(c.updatedAt) >= cutoffDate);
    console.log(`✅ ${activeTodayEvo.length} chats activos detectados.`);

    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    const { rows: dbMessages } = await pool.query(`SELECT DISTINCT conversation_phone FROM messages WHERE timestamp >= $1`, [cutoffDate.toISOString()]);
    const phonesInDb = new Set(dbMessages.map(m => m.conversation_phone));

    let totalSaved = 0;

    for (const chat of activeTodayEvo) {
        const jid = chat.remoteJid; // USAR SIEMPRE REMOTEJID
        if (!jid) continue;

        const normalizedPhone = normalizePhone(jid);
        if (!normalizedPhone) continue;

        // Si ya tenemos mensajes hoy para este teléfono, saltamos
        if (phonesInDb.has(normalizedPhone)) continue;

        console.log(`📩 Recuperando para: ${normalizedPhone} (${chat.pushName || 'S.N'})`);

        // Insertar conversación si no existe
        await pool.query(`
            INSERT INTO conversations (phone, contact_name, ai_enabled, status, updated_at)
            VALUES ($1, $2, true, 'active', NOW())
            ON CONFLICT (phone) DO UPDATE SET contact_name = EXCLUDED.contact_name
        `, [normalizedPhone, chat.pushName || chat.name || normalizedPhone]);

        // Pedir mensajes
        const msgRes = await fetch(`${BASE_URL}/chat/findMessages/${INSTANCE}`, {
            method: 'POST',
            headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 50 })
        });

        if (msgRes.ok) {
            const msgs = await msgRes.json();
            const records = Array.isArray(msgs) ? msgs : (msgs.messages?.records || msgs.records || []);
            for (const msg of records) {
                if (msg.messageTimestamp && msg.messageTimestamp >= cutoffTimestamp) {
                    const saved = await saveMessage(pool, normalizedPhone, msg);
                    if (saved) totalSaved++;
                }
            }
        }
    }

    console.log(`\n✨ Finalizado. Mensajes recuperados: ${totalSaved}`);
    await pool.end();
}

async function saveMessage(pool, phone, msg) {
    const whatsappId = msg.key?.id;
    if (!whatsappId) return false;
    const check = await pool.query('SELECT 1 FROM messages WHERE whatsapp_id = $1', [whatsappId]);
    if (check.rows.length > 0) return false;

    let text = '';
    let m = msg.message;
    if (!m) return false;
    if (m.ephemeralMessage) m = m.ephemeralMessage.message || m.ephemeralMessage;
    if (m.viewOnceMessage) m = m.viewOnceMessage.message || m;
    if (m.conversation) text = m.conversation;
    else if (m.extendedTextMessage?.text) text = m.extendedTextMessage.text;
    else if (m.imageMessage) text = m.imageMessage.caption || '📷 Foto';
    else if (m.videoMessage) text = m.videoMessage.caption || '🎥 Video';
    else if (m.audioMessage) text = '🎵 Audio';
    else if (m.documentMessage) text = m.documentMessage.fileName || '📄 Documento';
    else if (m.stickerMessage) text = '🎨 Sticker';
    if (!text) return false;

    const sender = msg.key.fromMe ? 'agent' : 'user';
    const timestamp = new Date(msg.messageTimestamp * 1000);

    await pool.query(`
        INSERT INTO messages (conversation_phone, sender, text_content, whatsapp_id, status, timestamp)
        VALUES ($1, $2, $3, $4, 'delivered', $5)
        ON CONFLICT (whatsapp_id) DO NOTHING
    `, [phone, sender, text, whatsappId, timestamp]);

    await pool.query(`
        UPDATE conversations SET last_message_text = $1, last_message_timestamp = $2
        WHERE phone = $3 AND (last_message_timestamp IS NULL OR last_message_timestamp < $2)
    `, [text, timestamp, phone]);

    return true;
}

recover().catch(console.error);
