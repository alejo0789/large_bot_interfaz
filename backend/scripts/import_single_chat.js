const { Pool } = require('pg');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

const TARGET_remoteJid = '573145325141-1571002611@g.us';

async function importSingle() {
    console.log(`🚀 Importing single chat: ${TARGET_remoteJid}`);

    try {
        // 1. Fetch Messages directly
        const messages = await fetchMessages(TARGET_remoteJid);
        console.log('DEBUG: messages type:', typeof messages);
        console.log('DEBUG: isArray:', Array.isArray(messages));
        console.log(`📨 Found ${messages?.length} messages.`);

        if (!messages || messages.length === 0) {
            console.log('⚠️ No messages found. Aborting.');
            return;
        }

        const phone = TARGET_remoteJid.split('@')[0];
        const name = "Test Chat Import";

        // 2. Upsert Conversation
        await pool.query(`
            INSERT INTO conversations (phone, contact_name, ai_enabled, status, updated_at)
            VALUES ($1, $2, true, 'active', NOW())
            ON CONFLICT (phone) DO UPDATE 
            SET contact_name = EXCLUDED.contact_name, updated_at = NOW()
        `, [phone, name]);
        console.log('✅ Conversation upserted.');

        // 3. Save Messages
        for (const msg of messages) {
            await saveMessage(phone, msg);
        }
        console.log('✅ All messages saved.');

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await pool.end();
    }
}

async function fetchMessages(remoteJid) {
    const url = `${BASE_URL}/chat/findMessages/${INSTANCE}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "where": {
                    "key": { "remoteJid": remoteJid }
                },
                "limit": 10
            })
        });

        if (!res.ok) {
            console.error(`❌ Fetch Failed: ${res.status}`);
            return [];
        }
        const data = await res.json();
        console.log('DEBUG: Full Data Keys:', Object.keys(data));
        if (data.messages) {
            console.log('DEBUG: data.messages keys:', Object.keys(data.messages));
            console.log('DEBUG: data.messages content sample:', JSON.stringify(data.messages).substring(0, 200));
        }

        let messagesArray = [];
        if (Array.isArray(data)) messagesArray = data;
        else if (Array.isArray(data.messages)) messagesArray = data.messages;
        else if (typeof data.messages === 'object') {
            // If messages is an object, maybe it contains records or we need to extract values?
            // Or maybe it's just metadata?
            messagesArray = Object.values(data.messages); // Try converting values to array just in case
            // Wait, let's see the logs before deciding if Object.values is correct.
            // But to make progress, I'll log and return empty for now to avoid crash, or return Object.values if it looks like a map.
        }
        return messagesArray;
    } catch (e) {
        console.error('❌ Fetch Error:', e);
        return [];
    }
}

async function saveMessage(phone, msg) {
    const key = msg.key;
    if (!key) return;

    const fromMe = key.fromMe;
    const whatsappId = key.id;
    // timestamp is in seconds in Evolution, check if correct
    const timestamp = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000) : new Date();

    let text = '';
    let mediaType = null;
    let mediaUrl = null;

    if (msg.message?.conversation) text = msg.message.conversation;
    else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
    else if (msg.message?.imageMessage) {
        text = msg.message.imageMessage.caption || '📷 Image';
        mediaType = 'image';
    }
    else if (msg.message?.stickerMessage) {
        text = '📦 Sticker';
        mediaType = 'image';
    }

    if (!text && !mediaType) {
        console.log('   ⚠️ Skipping empty message:', whatsappId);
        return;
    }

    const sender = fromMe ? 'agent' : 'user';

    console.log(`   💾 Saving: ${text.substring(0, 20)}... (${sender})`);

    try {
        await pool.query(`
            INSERT INTO messages (
                conversation_phone, sender, text_content, whatsapp_id, 
                media_type, media_url, status, timestamp, agent_name
            ) VALUES ($1, $2, $3, $4, $5, $6, 'delivered', $7, $8)
            ON CONFLICT (whatsapp_id) DO NOTHING
        `, [phone, sender, text, whatsappId, mediaType, mediaUrl, timestamp, fromMe ? 'Me' : null]);

        await pool.query(`
            UPDATE conversations 
            SET last_message_text = $1, last_message_timestamp = $2
            WHERE phone = $3 AND (last_message_timestamp IS NULL OR last_message_timestamp < $2)
        `, [text, timestamp, phone]);
    } catch (err) {
        console.error('   ❌ DB Error:', err.message);
    }
}

importSingle();
