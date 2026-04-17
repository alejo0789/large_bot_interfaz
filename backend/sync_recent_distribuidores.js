const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { Pool } = require('pg');

// Config for "distribuidoresventas2"
const dbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require';

const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'distribuidores_ventas';

const DAYS_AGO = 2;
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - DAYS_AGO);
const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);

// Crear pool nuevo en cada llamada para evitar timeouts de Neon
function createPool() {
    return new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
        max: 3,
        idleTimeoutMillis: 20000,
        connectionTimeoutMillis: 10000
    });
}

async function syncRecent() {
    console.log(`🚀 Sincronizando chats de los últimos ${DAYS_AGO} días para [${INSTANCE}]...`);
    console.log(`📅 Desde: ${cutoffDate.toISOString()}`);

    // Fetch chats
    const chatUrl = `${BASE_URL}/chat/findChats/${INSTANCE}`;
    console.log(`🔍 Cargando lista de chats desde Evolution API...`);
    const chatRes = await fetch(chatUrl, {
        method: 'POST',
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ where: {}, limit: 1000 })
    });

    if (!chatRes.ok) throw new Error(`Error fetching chats: ${chatRes.status}`);

    const chatData = await chatRes.json();
    const chats = Array.isArray(chatData) ? chatData : (chatData.chats || []);

    // Sort by most recent first so we can stop early
    chats.sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0));

    console.log(`✅ ${chats.length} chats encontrados. Filtrando los de los últimos ${DAYS_AGO} días...`);

    let processedCount = 0;
    let newMsgCount = 0;
    let breakCause = '';

    for (let i = 0; i < chats.length; i++) {
        const chat = chats[i];
        
        // Use lastMessage timestamp or updatedAt as fallback
        const lastActive = chat.lastMessage?.messageTimestamp || 
                          (chat.updatedAt ? Math.floor(new Date(chat.updatedAt).getTime() / 1000) : 0);

        // Stop once we're past the cutoff (they're ordered desc)
        if (lastActive < cutoffTimestamp && lastActive !== 0) {
            breakCause = `Chat ${i + 1} demasiado antiguo (${new Date(lastActive * 1000).toLocaleDateString()})`;
            break;
        }

        const remoteJid = chat.remoteJid || chat.id;
        if (!remoteJid) continue;

        const phone = remoteJid.includes('@') ? remoteJid.split('@')[0] : remoteJid;
        const name = chat.pushName || chat.name || phone;

        // UPSERT conversation - fresh pool each iteration to avoid stale connections
        const pool = createPool();
        try {
            await pool.query(`
                INSERT INTO conversations (phone, contact_name, ai_enabled, status, updated_at)
                VALUES ($1, $2, true, 'active', NOW())
                ON CONFLICT (phone) DO UPDATE 
                SET contact_name = EXCLUDED.contact_name, updated_at = NOW()
            `, [phone, name]);

            // Fetch messages from Evolution
            const msgUrl = `${BASE_URL}/chat/findMessages/${INSTANCE}`;
            const msgRes = await fetch(msgUrl, {
                method: 'POST',
                headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    where: { key: { remoteJid: remoteJid } },
                    limit: 100
                })
            });

            if (msgRes.ok) {
                const msgs = await msgRes.json();
                const records = Array.isArray(msgs) ? msgs :
                    (msgs.messages?.records || msgs.records || []);

                for (const msg of records) {
                    if (msg.messageTimestamp && msg.messageTimestamp >= cutoffTimestamp) {
                        const saved = await saveMessageWithPool(pool, phone, msg);
                        if (saved) newMsgCount++;
                    }
                }
            }
        } finally {
            await pool.end();
        }

        processedCount++;
        if (processedCount % 10 === 0) {
            console.log(`⏳ Procesados ${processedCount} chats — Nuevos mensajes: ${newMsgCount}`);
        }
    }

    console.log(`\n✨ Sincronización Completada!`);
    console.log(`📊 Chats procesados: ${processedCount}`);
    console.log(`📊 Mensajes nuevos guardados: ${newMsgCount}`);
    if (breakCause) console.log(`🛑 Detenido en: ${breakCause}`);
}

async function saveMessageWithPool(pool, phone, msg) {
    const key = msg.key;
    if (!key || !key.id) return false;

    const whatsappId = key.id;
    const timestamp = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date();

    // Check duplicate
    const check = await pool.query('SELECT 1 FROM messages WHERE whatsapp_id = $1', [whatsappId]);
    if (check.rows.length > 0) return false;

    // Parse text
    let text = '';
    const m = msg.message;
    if (!m) return false;

    let t = m;
    if (t.ephemeralMessage) t = t.ephemeralMessage.message || t.ephemeralMessage;
    if (t.viewOnceMessage) t = t.viewOnceMessage.message || t;

    if (t.conversation) text = t.conversation;
    else if (t.extendedTextMessage?.text) text = t.extendedTextMessage.text;
    else if (t.imageMessage) text = t.imageMessage.caption || '📷 Foto';
    else if (t.videoMessage) text = t.videoMessage.caption || '🎥 Video';
    else if (t.audioMessage) text = '🎵 Audio';
    else if (t.documentMessage) text = t.documentMessage.fileName || '📄 Documento';
    else if (t.stickerMessage) text = '🎨 Sticker';

    if (!text) return false;

    const sender = key.fromMe ? 'agent' : 'user';

    await pool.query(`
        INSERT INTO messages (conversation_phone, sender, text_content, whatsapp_id, status, timestamp)
        VALUES ($1, $2, $3, $4, 'delivered', $5)
        ON CONFLICT (whatsapp_id) DO NOTHING
    `, [phone, sender, text, whatsappId, timestamp]);

    // Update conversation last msg
    await pool.query(`
        UPDATE conversations 
        SET last_message_text = $1, last_message_timestamp = $2
        WHERE phone = $3 AND (last_message_timestamp IS NULL OR last_message_timestamp < $2)
    `, [text, timestamp, phone]);

    return true;
}

syncRecent().catch(console.error);
