const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { Pool } = require('pg');

const dbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/cuadros_bga_db?sslmode=require';
const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = '8B96AC4A3CB1-4CA9-A7C7-41DA1BE2EA74'; // Reusing standard generic hash check for evolution or we can try with dynamic. Wait! We need the true API key!
// Actually, earlier query yielded a blank API key... Oh wait, Evolution API allows using the global API Key. In .env it's EVOLUTION_API_KEY.
const globalApiKey = process.env.EVOLUTION_API_KEY || '8B96AC4A3CB1-4CA9-A7C7-41DA1BE2EA74'; // From view of previous scripts. Let's require dotenv to be sure.
require('dotenv').config();

const INSTANCE = 'large_caudrosbga_1';
const DAYS_AGO = 10;

const daysAgoDate = new Date();
daysAgoDate.setDate(daysAgoDate.getDate() - DAYS_AGO);
const daysAgoSecs = Math.floor(daysAgoDate.getTime() / 1000);

async function sync10Days() {
    const apiKey = process.env.EVOLUTION_API_KEY || '8B96AC4A3CB1-4CA9-A7C7-41DA1BE2EA74'; // Often fallback
    console.log(`🚀 Sincronizando chats de los ultimos ${DAYS_AGO} dias para ${INSTANCE}...`);

    try {
        const url = `${BASE_URL}/chat/findChats/${INSTANCE}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ where: {}, limit: 2000 })
        });

        if (!res.ok) {
            console.error(`❌ Error fetching chats: ${res.status}`);
            return;
        }

        const data = await res.json();
        const chats = Array.isArray(data) ? data : (data.chats || []);
        console.log(`✅  Encontrados ${chats.length} chats... procesando...`);

        for (const chat of chats) {
             if (chat.conversationTimestamp && chat.conversationTimestamp < daysAgoSecs) {
                 continue;       
             }

            const remoteJid = chat.remoteJid || chat.id;
            const phone = remoteJid ? remoteJid.split('@')[0] : null;
            if (!phone) continue;

            const name = chat.pushName || chat.name || phone;

            await pool.query(`
                INSERT INTO conversations (phone, contact_name, ai_enabled, status, updated_at)
                VALUES ($1, $2, true, 'active', NOW())
                ON CONFLICT (phone) DO UPDATE 
                SET contact_name = EXCLUDED.contact_name, updated_at = NOW()
            `, [phone, name]);

            const msgUrl = `${BASE_URL}/chat/findMessages/${INSTANCE}`;
            const msgRes = await fetch(msgUrl, {
                method: 'POST',
                headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    where: { key: { remoteJid: remoteJid } },
                    limit: 100
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
                         if (!msg.messageTimestamp || msg.messageTimestamp < daysAgoSecs) {
                             continue;
                         }
                         await saveMessage(phone, msg);
                    }
                }
            }
        }

        console.log('✨ Sincronizacion completada!');
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
        text = msg.message.imageMessage.caption || '📷 Image';
        mediaType = 'image';
    }
    else if (msg.message?.audioMessage) {
        text = '🎵 Audio';
        mediaType = 'audio';
    }

    if (!text && !mediaType) return;

    const sender = fromMe ? 'agent' : 'user';

    await pool.query(`
        INSERT INTO messages (
            conversation_phone, sender, text_content, whatsapp_id, 
            media_type, media_url, status, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, 'delivered', $7)
        ON CONFLICT (whatsapp_id) DO NOTHING
    `, [phone, sender, text, whatsappId, mediaType, mediaUrl, timestamp]);

    await pool.query(`
        UPDATE conversations 
        SET last_message_text = $1, last_message_timestamp = $2
        WHERE phone = $3 AND (last_message_timestamp IS NULL OR last_message_timestamp < $2)
    `, [text, timestamp, phone]);
}

sync10Days();
