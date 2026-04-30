const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { Pool } = require('pg');

// Configuración para Medellín 2
const MEDELLIN_DB_URL = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/medellin2?sslmode=require&channel_binding=require';
const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'large_medellin2';

const pool = new Pool({
    connectionString: MEDELLIN_DB_URL,
    ssl: { rejectUnauthorized: false }
});

// 15 days ago timestamp
const daysToSync = 15;
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - daysToSync);
const cutoffTimestampSecs = Math.floor(cutoffDate.getTime() / 1000);

async function sync15Days() {
    console.log(`🚀 Sincronizando chats de los últimos ${daysToSync} días para ${INSTANCE}...`);
    console.log(`Cutoff date: ${cutoffDate.toISOString()}`);

    try {
        const url = `${BASE_URL}/chat/findChats/${INSTANCE}`;
        console.log(`Fetching chats desde ${url}`);
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                where: {},
                limit: 1500 
            })
        });

        if (!res.ok) {
            console.error(`❌ Error fetching chats: ${res.status}`);
            const t = await res.text();
            console.error(t);
            return;
        }

        const data = await res.json();
        const chats = Array.isArray(data) ? data : (data.chats || []);

        console.log(`✅ Encontrados ${chats.length} chats totales en Evolution.`);

        let processedCount = 0;
        let messageCount = 0;

        for (const chat of chats) {
            // Filtrar chats que no tienen actividad reciente
            const lastActivity = chat.conversationTimestamp || chat.messageTimestamp;
            if (lastActivity && lastActivity < cutoffTimestampSecs) {
                continue;
            }

            const remoteJid = chat.remoteJid || chat.id;
            if (!remoteJid || !remoteJid.endsWith('@s.whatsapp.net')) continue; // Solo contactos individuales

            const rawPhone = remoteJid.split('@')[0];
            const phone = '+' + rawPhone.replace(/\D/g, ''); // Normalizar: + y números
            
            if (!phone || phone.length > 15) continue; 

            const name = chat.pushName || chat.name || phone;
            processedCount++;

            console.log(`Processing chat: ${name} (${phone})...`);

            // Upsert conversation
            await pool.query(`
                INSERT INTO conversations (phone, contact_name, ai_enabled, status, updated_at, lead_intent, lead_time)
                VALUES ($1, $2, true, 'active', NOW(), NULL, NULL)
                ON CONFLICT (phone) DO UPDATE 
                SET contact_name = EXCLUDED.contact_name, updated_at = NOW()
            `, [phone, name]);

            // Fetch messages for this chat
            const msgUrl = `${BASE_URL}/chat/findMessages/${INSTANCE}`;
            const msgRes = await fetch(msgUrl, {
                method: 'POST',
                headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    where: { key: { remoteJid: remoteJid } },
                    limit: 50 // Ultimos 50 mensajes por chat
                })
            });

            if (msgRes.ok) {
                const msgData = await msgRes.json();
                let messages = [];

                if (Array.isArray(msgData)) messages = msgData;
                else if (Array.isArray(msgData.messages)) messages = msgData.messages;
                else if (msgData.messages && Array.isArray(msgData.messages.records)) messages = msgData.messages.records;
                else if (Array.isArray(msgData.records)) messages = msgData.records;

                if (messages.length > 0) {
                    for (const msg of messages) {
                        const msgTs = msg.messageTimestamp;
                        if (!msgTs || msgTs < cutoffTimestampSecs) {
                            continue;
                        }
                        await saveMessage(phone, msg);
                        messageCount++;
                    }
                }
            }
        }

        console.log(`\n✨ Sincronización completada!`);
        console.log(`   - Chats procesados: ${processedCount}`);
        console.log(`   - Mensajes guardados: ${messageCount}`);
    } catch (e) {
        console.error('❌ Error fatal:', e.message);
    } finally {
        await pool.end();
    }
}

async function saveMessage(phone, msg) {
    const key = msg.key;
    if (!key) return;

    const fromMe = key.fromMe;
    const whatsappId = key.id;
    const timestamp = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date();

    let text = '';
    let mediaType = null;
    let mediaUrl = null;

    if (msg.message?.conversation) text = msg.message.conversation;
    else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
    else if (msg.message?.imageMessage) {
        text = msg.message.imageMessage.caption || '📷 Imagen';
        mediaType = 'image';
    }
    else if (msg.message?.videoMessage) {
        text = msg.message.videoMessage.caption || '🎥 Video';
        mediaType = 'video';
    }
    else if (msg.message?.audioMessage) {
        text = '🎤 Nota de voz';
        mediaType = 'audio';
    }
    else if (msg.message?.documentMessage) {
        text = `📄 ${msg.message.documentMessage.fileName || 'Documento'}`;
        mediaType = 'document';
    }

    if (!text && !mediaType) return;

    const sender = fromMe ? 'agent' : 'user';
    const senderName = fromMe ? 'Tú' : (msg.pushName || 'Cliente');

    try {
        await pool.query(`
            INSERT INTO messages (
                conversation_phone, sender, text_content, whatsapp_id, 
                media_type, media_url, status, timestamp, sender_name
            ) VALUES ($1, $2, $3, $4, $5, $6, 'delivered', $7, $8)
            ON CONFLICT (whatsapp_id) DO NOTHING
        `, [phone, sender, text, whatsappId, mediaType, mediaUrl, timestamp, senderName]);

        // Actualizar último mensaje en la conversación si este es más reciente
        await pool.query(`
            UPDATE conversations 
            SET 
                last_message_text = $1, 
                last_message_timestamp = $2,
                last_message_from_me = $3
            WHERE phone = $4 AND (last_message_timestamp IS NULL OR last_message_timestamp <= $2)
        `, [text, timestamp, fromMe, phone]);
    } catch (err) {
        // Ignorar errores individuales
    }
}

sync15Days();
