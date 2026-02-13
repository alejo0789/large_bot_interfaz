/**
 * Import History from Evolution API - VERSION CON DEBUG
 * Fetches chats and messages from the API and saves them to local DB
 */
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

async function importHistory() {
    console.log('🚀 Starting History Import...');
    console.log(`📡 URL: ${BASE_URL} | Instance: ${INSTANCE}`);

    try {
        // 1. Fetch Chats
        console.log('\n🔍 Fetching Chats...');
        const chats = await fetchChats();

        if (!chats || chats.length === 0) {
            console.log('❌ No chats found or API error.');
            return;
        }

        console.log(`✅ Found ${chats.length} chats. Processing...\n`);

        let processed = 0;
        let totalMessages = 0;
        let chatsWithMessages = 0;

        for (const chat of chats) {
            const messageCount = await processChat(chat);
            totalMessages += messageCount;
            if (messageCount > 0) chatsWithMessages++;

            processed++;
            if (processed % 10 === 0) {
                console.log(`   Processed ${processed}/${chats.length} chats... (${totalMessages} messages so far)`);
            }
        }

        console.log('\n✨ Import Complete!');
        console.log(`📊 Summary:`);
        console.log(`   Total chats: ${chats.length}`);
        console.log(`   Chats with messages: ${chatsWithMessages}`);
        console.log(`   Total messages imported: ${totalMessages}`);

    } catch (error) {
        console.error('❌ Fatal Error:', error);
    } finally {
        await pool.end();
    }
}

async function fetchChats() {
    const url = `${BASE_URL}/chat/findChats/${INSTANCE}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "where": {},
                "limit": 1000
            })
        });

        if (!res.ok) {
            console.error(`❌ Fetch Chats Failed: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.error('Body:', text);
            return [];
        }

        const data = await res.json();
        return Array.isArray(data) ? data : (data.chats || []);
    } catch (e) {
        console.error('❌ Connection error fetching chats:', e.message);
        return [];
    }
}

async function processChat(chat) {
    const remoteJid = chat.remoteJid || chat.id;
    const phone = remoteJid ? remoteJid.split('@')[0] : null;

    if (!phone) return 0;

    const name = chat.pushName || chat.name || phone;

    // 1. Upsert Conversation
    await pool.query(`
        INSERT INTO conversations (phone, contact_name, ai_enabled, status, updated_at)
        VALUES ($1, $2, true, 'active', NOW())
        ON CONFLICT (phone) DO UPDATE 
        SET contact_name = EXCLUDED.contact_name, updated_at = NOW()
    `, [phone, name]);

    // 2. Fetch Messages for this Chat
    const messages = await fetchMessages(remoteJid, phone);

    if (messages && messages.length > 0) {
        for (const msg of messages) {
            await saveMessage(phone, msg);
        }
        return messages.length;
    }

    return 0;
}

async function fetchMessages(remoteJid, phone) {
    const url = `${BASE_URL}/chat/findMessages/${INSTANCE}`;
    try {
        console.log(`   🔍 Fetching messages for ${phone}...`);

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
                "limit": 100 // Aumentado de 50 a 100
            })
        });

        if (!res.ok) {
            console.log(`      ⚠️  Failed (${res.status}): ${res.statusText}`);
            return [];
        }

        const data = await res.json();

        // Handle various response formats
        let messages = [];
        if (Array.isArray(data)) {
            messages = data;
        } else if (Array.isArray(data.messages)) {
            messages = data.messages;
        } else if (data.messages && Array.isArray(data.messages.records)) {
            messages = data.messages.records;
        } else if (Array.isArray(data.records)) {
            messages = data.records;
        }

        if (messages.length > 0) {
            console.log(`      ✅ Found ${messages.length} messages`);
        } else {
            console.log(`      ℹ️  No messages found`);
        }

        return messages;
    } catch (e) {
        console.log(`      ❌ Error: ${e.message}`);
        return [];
    }
}

async function saveMessage(phone, msg) {
    // Extract basic info
    const key = msg.key;
    if (!key) return;

    const fromMe = key.fromMe;
    const whatsappId = key.id;
    const timestamp = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date();

    // Determine content
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

    // Insert Message
    await pool.query(`
        INSERT INTO messages (
            conversation_phone, sender, text_content, whatsapp_id, 
            media_type, media_url, status, timestamp, agent_name
        ) VALUES ($1, $2, $3, $4, $5, $6, 'delivered', $7, $8)
        ON CONFLICT (whatsapp_id) DO NOTHING
    `, [phone, sender, text, whatsappId, mediaType, mediaUrl, timestamp, fromMe ? 'Me' : null]);

    // Update last message in conversation if this is the newest
    await pool.query(`
        UPDATE conversations 
        SET last_message_text = $1, last_message_timestamp = $2
        WHERE phone = $3 AND (last_message_timestamp IS NULL OR last_message_timestamp < $2)
    `, [text, timestamp, phone]);
}

importHistory();
