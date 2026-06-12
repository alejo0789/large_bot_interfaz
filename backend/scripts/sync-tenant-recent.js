require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');
const { normalizePhone } = require('../src/utils/phoneUtils');

// Target Tenant Slug
const TARGET_SLUG = 'ciudadmontes';
const DAYS_LIMIT = 15;
const MSGS_LIMIT = 150; // Fetch up to 150 messages per chat to cover the 15 days

const MASTER_DB_URL = process.env.MASTER_DATABASE_URL;
const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

if (!MASTER_DB_URL) {
    console.error("❌ MASTER_DATABASE_URL is not set in environment.");
    process.exit(1);
}

function looksLikeLid(str) {
    if (!str) return true;
    const digits = str.replace(/\D/g, '');
    return digits.length > 10 && digits.length / str.length > 0.8;
}

async function main() {
    console.log(`🚀 Starting synchronization for tenant: ${TARGET_SLUG} (last ${DAYS_LIMIT} days)`);
    
    // 1. Connect to Master DB to get tenant configuration
    const masterPool = new Pool({ connectionString: MASTER_DB_URL });
    let tenant = null;
    try {
        const res = await masterPool.query(
            'SELECT id, name, slug, db_url, evolution_instance, evolution_api_key FROM tenants WHERE slug = $1 AND is_active = TRUE',
            [TARGET_SLUG]
        );
        if (res.rows.length === 0) {
            console.error(`❌ Tenant with slug '${TARGET_SLUG}' not found or inactive in Master DB.`);
            process.exit(1);
        }
        tenant = res.rows[0];
    } catch (err) {
        console.error("❌ Error querying Master DB:", err.message);
        process.exit(1);
    } finally {
        await masterPool.end();
    }

    const tenantDbUrl = tenant.db_url;
    const instance = tenant.evolution_instance;
    const apiKey = tenant.evolution_api_key || EVOLUTION_API_KEY;

    if (!tenantDbUrl || !instance) {
        console.error("❌ Tenant is missing db_url or evolution_instance configuration.");
        process.exit(1);
    }

    console.log(`📌 Sede: ${tenant.name}`);
    console.log(`📌 Instance: ${instance}`);
    console.log(`📌 Db: ${tenantDbUrl.split('@')[1] || 'neon'}`);

    // Calculate the cut-off timestamp (15 days ago in seconds)
    const cutoffTimeMs = Date.now() - DAYS_LIMIT * 24 * 60 * 60 * 1000;
    const cutoffTimeSec = Math.floor(cutoffTimeMs / 1000);

    // 2. Connect to Tenant DB
    const tenantPool = new Pool({ connectionString: tenantDbUrl });

    try {
        // --- CLEANUP STEP ---
        console.log("🧹 Cleaning up old unresolved @lid conversations from Tenant DB...");
        const cleanupRes = await tenantPool.query("DELETE FROM conversations WHERE phone LIKE '%@lid'");
        console.log(`🗑️ Deleted ${cleanupRes.rowCount} unresolved LID conversations.`);

        // 3. Fetch chats from Evolution
        console.log("📋 Fetching chats list from Evolution...");
        const chatsRes = await axios.post(`${EVOLUTION_BASE_URL}/chat/findChats/${instance}`, {}, {
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey }
        });

        const chatsData = chatsRes.data;
        const chats = Array.isArray(chatsData) ? chatsData : (chatsData.chats || chatsData.data || []);
        console.log(`✅ Found ${chats.length} chats in instance.`);

        // 4. Pre-resolve LIDs via API
        console.log("🕵️ Resolving JID/LIDs...");
        const lidMap = new Map();
        const lidsToResolve = chats
            .map(c => c.id || c.remoteJid)
            .filter(jid => jid && jid.includes('@lid'));

        if (lidsToResolve.length > 0) {
            console.log(`📡 Resolving ${lidsToResolve.length} LIDs via whatsappNumbers API...`);
            for (let i = 0; i < lidsToResolve.length; i += 50) {
                const chunk = lidsToResolve.slice(i, i + 50);
                try {
                    const res = await axios.post(`${EVOLUTION_BASE_URL}/chat/whatsappNumbers/${instance}`, {
                        numbers: chunk
                    }, {
                        headers: { 'Content-Type': 'application/json', 'apikey': apiKey }
                    });
                    if (Array.isArray(res.data)) {
                        for (const r of res.data) {
                            if (r.exists && r.jid && r.number) {
                                // Map digits
                                lidMap.set(r.number, r.jid);
                                // Map full JID with @lid
                                if (!String(r.number).includes('@')) {
                                    lidMap.set(`${r.number}@lid`, r.jid);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Error resolving LID chunk ${i}:`, e.message);
                }
            }
            console.log(`✅ Resueltos ${lidMap.size} LIDs.`);
        }

        // 5. Process each chat
        let totalInsertedMessages = 0;
        let totalUpdatedConversations = 0;

        for (const chat of chats) {
            const jid = chat.id || chat.remoteJid;
            let targetJid = lidMap.get(jid) || jid;
            let phone = normalizePhone(targetJid);

            if (!phone || phone.includes('@lid')) {
                if (!phone) {
                    console.log(`⏩ Skipping unparseable JID: ${jid}`);
                    continue;
                }
            }

            console.log(`\n⏳ Fetching messages for ${phone} (${jid})...`);

            // Fetch messages for this JID
            let messages = [];
            try {
                const msgsRes = await axios.post(`${EVOLUTION_BASE_URL}/chat/findMessages/${instance}`, {
                    where: { key: { remoteJid: jid } },
                    limit: MSGS_LIMIT
                }, {
                    headers: { 'Content-Type': 'application/json', 'apikey': apiKey }
                });

                const msgsData = msgsRes.data;
                messages = Array.isArray(msgsData) ? msgsData : (msgsData.messages?.records || msgsData.records || msgsData.data || []);
            } catch (err) {
                console.error(`❌ Error fetching messages for ${phone}:`, err.message);
                continue;
            }

            // Filter messages by 15-day limit
            const recentMessages = messages.filter(msg => {
                const ts = msg.messageTimestamp;
                return ts && ts >= cutoffTimeSec;
            });

            console.log(`   Fetched: ${messages.length} | Within last ${DAYS_LIMIT} days: ${recentMessages.length}`);

            if (recentMessages.length === 0) {
                console.log(`   ⏩ No messages in the last ${DAYS_LIMIT} days for this chat. Skipping.`);
                continue;
            }

            // Resolve best name
            let bestName = phone;
            for (const m of recentMessages) {
                if (!m.key.fromMe && m.pushName && !m.pushName.includes('@') && !looksLikeLid(m.pushName) && m.pushName.length > 1) {
                    bestName = m.pushName;
                    break;
                }
            }
            if (bestName === phone) {
                const chatName = chat.name || chat.pushName;
                if (chatName && !looksLikeLid(chatName) && chatName.length > 1) {
                    bestName = chatName;
                }
            }

            // Upsert conversation
            await tenantPool.query(`
                INSERT INTO conversations (phone, contact_name, status, created_at, updated_at, ai_enabled, conversation_state, channel)
                VALUES ($1, $2, 'active', NOW(), NOW(), false, 'agent_active', 'whatsapp_evolution')
                ON CONFLICT (phone) DO UPDATE SET updated_at = NOW(), contact_name = EXCLUDED.contact_name
            `, [phone, bestName]);
            totalUpdatedConversations++;

            // Insert messages
            let savedInChat = 0;
            for (const msg of recentMessages) {
                const whatsappId = msg.key.id;
                const isFromMe = msg.key.fromMe;
                const sender = isFromMe ? 'agent' : 'user';
                const timestamp = new Date(msg.messageTimestamp * 1000);

                let text = '';
                if (msg.message?.conversation) text = msg.message.conversation;
                else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
                else if (msg.message?.imageMessage?.caption) text = msg.message.imageMessage.caption;
                else if (msg.message?.videoMessage?.caption) text = msg.message.videoMessage.caption;

                const dbText = text || (msg.message?.imageMessage ? '📷 Imagen' : (msg.message?.videoMessage ? '🎥 Video' : (msg.message?.audioMessage ? '🎤 Audio' : '📎 Archivo')));
                const senderName = isFromMe ? 'Tú' : (msg.pushName && !looksLikeLid(msg.pushName) ? msg.pushName : bestName);

                try {
                    const insertRes = await tenantPool.query(`
                        INSERT INTO messages (
                            conversation_phone, sender, text_content, whatsapp_id, timestamp, status, sender_name
                        ) VALUES ($1, $2, $3, $4, $5, 'delivered', $6)
                        ON CONFLICT (whatsapp_id) DO NOTHING
                    `, [phone, sender, dbText, whatsappId, timestamp, senderName]);
                    
                    if (insertRes.rowCount > 0) {
                        savedInChat++;
                    }
                } catch (dbErr) {
                    console.error(`   ❌ Error saving message ${whatsappId}:`, dbErr.message);
                }
            }

            // Update conversation last message based on the most recent message in our subset
            if (recentMessages.length > 0) {
                // messages from findMessages are usually ordered newest first, let's make sure
                const sortedRecent = [...recentMessages].sort((a, b) => b.messageTimestamp - a.messageTimestamp);
                const newestMsg = sortedRecent[0];
                let newestText = newestMsg.message?.conversation || newestMsg.message?.extendedTextMessage?.text || 'Archivo';
                await tenantPool.query(
                    "UPDATE conversations SET last_message_text = $1, last_message_timestamp = $2 WHERE phone = $3",
                    [newestText.substring(0, 100), new Date(newestMsg.messageTimestamp * 1000), phone]
                );
            }

            console.log(`   ✅ Saved ${savedInChat} messages.`);
            totalInsertedMessages += savedInChat;
        }

        console.log(`\n🎉 Sync finished successfully!`);
        console.log(`📊 Total conversations updated/created: ${totalUpdatedConversations}`);
        console.log(`📊 Total new messages inserted: ${totalInsertedMessages}`);

    } catch (err) {
        console.error("❌ Critical error during synchronization:", err);
    } finally {
        await tenantPool.end();
    }
}

main().catch(console.error);
