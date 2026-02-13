/**
 * Evolution API Webhook Routes
 * Handles incoming messages from Evolution API
 */
const express = require('express');
const router = express.Router();
const messageService = require('../services/messageService');
const conversationService = require('../services/conversationService');

const evolutionService = require('../services/evolutionService');
const n8nService = require('../services/n8nService');
const settingsService = require('../services/settingsService');

let io = null;
const setSocketIO = (socketIO) => { io = socketIO; };

// Helper to emit events (Duplicate of webhooks.js logic - could be refactored to a shared service)
const emitToConversation = (phone, event, data) => {
    if (!io) return;

    console.log(`📡 Emitting ${event} to conversation:${phone}`);
    io.to(`conversation:${phone}`).emit(event, data);

    // Also emit to conversations:list to update sidebar in real-time
    io.to('conversations:list').emit('conversation-updated', {
        phone,
        lastMessage: data.message,
        timestamp: data.timestamp || new Date().toISOString(),
        contact_name: data.contact_name, // Added for new conversations
        unread: 1,
        isNew: data.isNew || false
    });

    // Also emit globally for compatibility until everything is room-based
    io.emit('new-message', data);
};

router.post('/', async (req, res) => {
    try {
        const { event, data, instance } = req.body;
        console.log(`📨 Evolution Event: ${event}`);

        // Only process 'messages.upsert' (check both cases)
        if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
            return res.sendStatus(200);
        }

        const msg = data;
        if (!msg || !msg.key) {
            return res.sendStatus(200);
        }

        // Determine if this message is from the business (agent) or from client (user)
        const isFromAgent = msg.key.fromMe === true;
        const senderType = isFromAgent ? 'agent' : 'user';

        console.log(`📋 Message Type: ${isFromAgent ? 'FROM AGENT (your phone)' : 'FROM CLIENT'}`);

        const remoteJid = msg.key.remoteJid;
        const isGroup = remoteJid.includes('@g.us');

        console.log(`🔍 [WEBHOOK] Processing message from JID: ${remoteJid} (isGroup: ${isGroup})`);

        // Better phone extraction: 
        // 1. If it's a group, keep as is
        // 2. If it ends in @s.whatsapp.net, strip it (normal phone)
        // 3. IF IT HAS ANY OTHER DOMAIN (@lid, @c.us, @newsletter), KEEP IT FULL!
        let phone;
        if (isGroup) {
            phone = remoteJid;
        } else {
            // Normalize standard numbers (strip domain, strip non-numeric)
            const numeric = remoteJid.split('@')[0].replace(/\D/g, '');
            // For Colombia numbers (starting with 57), add the '+' prefix for consistency with DB
            phone = (numeric.startsWith('57')) ? `+${numeric}` : numeric;

            if (!remoteJid.endsWith('@s.whatsapp.net')) {
                console.log(`⚠️ Non-standard JID domain detected, but using normalized phone: ${phone}`);
            }
        }

        if (!phone) {
            console.log(`⚠️ Could not extract phone/id from JID: ${remoteJid}`);
            return res.sendStatus(200);
        }

        console.log(`📱 [WEBHOOK] Final Phone/ID used: ${phone}`);

        let pushName = msg.pushName;

        // If it's a private chat and the message is from me (agent), 
        // the pushName belongs to the agent, not the contact.
        // We should not use it to update the contact's name.
        let nameToUse = (isGroup || !isFromAgent) ? pushName : null;

        // If it's a group, try to get the group subject
        if (isGroup) {
            const existingConv = await conversationService.getByPhone(phone);
            const nameIsPlaceholder = !existingConv ||
                existingConv.contact_name.includes('@g.us') ||
                existingConv.contact_name.startsWith('Grupo');

            if (nameIsPlaceholder) {
                const groupInfo = await evolutionService.fetchGroupInfo(phone);
                console.log(`🔍 Group Info Response for ${phone}:`, JSON.stringify(groupInfo));

                if (groupInfo && groupInfo.subject) {
                    pushName = groupInfo.subject;
                    // Force update in DB if it already exists but with wrong name
                    if (existingConv) {
                        await conversationService.upsert(phone, pushName);
                    }
                } else {
                    // Fallback to something better than "Usuario g.us"
                    // Try to use the previous name if it wasn't a placeholder,
                    // or format the JID ID nicely.
                    const jidId = phone.split('@')[0];
                    pushName = (existingConv && !existingConv.contact_name.includes('@'))
                        ? existingConv.contact_name
                        : `Grupo ${jidId.substring(0, 10)}...`;
                }
                console.log(`👥 Group Name Resolved: ${pushName} (${phone})`);
            } else {
                pushName = existingConv.contact_name;
            }

            // For groups, nameToUse MUST be the group subject, not the member pushName
            nameToUse = pushName;
        }

        // Extract text
        // Extract text
        let text = '';
        let mediaType = null;
        let mediaUrl = null;
        let mimetype = null;

        if (msg.message.conversation) {
            text = msg.message.conversation;
        } else if (msg.message.extendedTextMessage?.text) {
            text = msg.message.extendedTextMessage.text;
        } else if (msg.message.imageMessage) {
            text = msg.message.imageMessage.caption || '📷 Imagen';
            mediaType = 'image';
            mediaUrl = msg.message.imageMessage.url;
            mimetype = msg.message.imageMessage.mimetype || 'image/jpeg';
        } else if (msg.message.videoMessage) {
            text = msg.message.videoMessage.caption || '🎥 Video';
            mediaType = 'video';
            mediaUrl = msg.message.videoMessage.url;
            mimetype = msg.message.videoMessage.mimetype || 'video/mp4';
        } else if (msg.message.audioMessage) {
            text = '🎵 Audio';
            mediaType = 'audio';
            mediaUrl = msg.message.audioMessage.url;
            mimetype = msg.message.audioMessage.mimetype || 'audio/ogg; codecs=opus';
        } else if (msg.message.documentMessage) {
            text = msg.message.documentMessage.fileName || '📄 Documento';
            mediaType = 'document';
            mediaUrl = msg.message.documentMessage.url;
            mimetype = msg.message.documentMessage.mimetype || 'application/pdf';
        }

        // --- MEDIA HANDLING: BASE64 PRIORITY ---
        // Debugging Base64 Arrival
        console.log(`🔎 [DEBUG MEDIA] Keys in msg object: ${Object.keys(msg).join(', ')}`);

        let finalBase64 = msg.base64;

        // Fallback: If no base64 in webhook, try to fetch it from Evolution API
        if (!finalBase64 && mediaType) {
            console.log(`⚠️ No base64 in webhook. Attempting to fetch media from Evolution API for [${mediaType}]...`);
            try {
                finalBase64 = await evolutionService.fetchBase64(msg); // Pass full message object
                if (finalBase64) {
                    console.log(`✅ Successfully fetched base64 from API! Length: ${finalBase64.length}`);
                } else {
                    console.warn(`❌ Failed to fetch base64 from API.`);
                }
            } catch (errFallback) {
                console.error(`❌ Error in fetchBase64 fallback: ${errFallback.message}`);
            }
        }

        if (finalBase64) {
            console.log(`💎 Base64 Media ready! Creating Data URI for [${mediaType}]`);
            // Construct Data URI: data:<mediatype>;base64,<data>
            mediaUrl = `data:${mimetype};base64,${finalBase64}`;
        } else if (mediaUrl && mediaUrl.includes('whatsapp.net')) {
            console.warn(`⚠️ Warning: Using internal WhatsApp URL which may not be accessible: ${mediaUrl}`);
        }

        // --- MEDIA URL FALLBACK LOGIC ---
        // Evolution v2 often sends the media URL in a different top-level field or inside the message object depending on config.
        // If the direct .url above is missing (which happens if not using global url), we might need to check other fields.
        // However, standard Evolution saves to a public URL if configured. 
        // Let's ensure we grab it if it exists in expected Evolution fields. 
        // Sometimes it comes in `msg.message.imageMessage.url` is internal whatsapp URL (not downloadable directly without auth).
        // Evolution sometimes injects a 'mediaUrl' property in the root of data if configured to process media.
        // Let's check for `base64` as a fallback or if we need to fetch it.

        // For now, assuming you have Evolution configured to return the media URL. 
        // If you see issues, we might need to use the /chat/fetchMedia buffer endpoint.

        // Let's actually use the top level `mediaUrl` if provided by some Evolution versions or check the nested one.
        // NOTE: The `url` inside `imageMessage` is usually the WhatsApp internal URL. 
        // Evolution typically provides the accessible URL in `data.mediaUrl` or `data.base64`.
        // BUT, looking at your payload structure (you didn't provide one for media), I will assume standard fields.

        // HOTFIX: Many users use "Save Media" in Evolution which populates a specific field.
        // If `mediaUrl` is still null, let's try to look for it in the root `data` object if it exists there (some forks do this).
        // const possibleUrl = data.mediaUrl || data.url; 
        // if (!mediaUrl && possibleUrl) mediaUrl = possibleUrl;

        // CRITICAL: Audio messages often come as PTT (Push To Talk).
        if (msg.message.audioMessage && msg.message.audioMessage.ptt) {
            text = '🎤 Nota de voz';
        }

        if (mediaType) {
            console.log(`📎 Media Detected [${mediaType}]:`);
            console.log(`   - Extracted URL: ${mediaUrl}`);
            // Log a snippet of the message to check structure
            console.log(`   - Raw Message Snippet: ${JSON.stringify(msg.message).substring(0, 200)}...`);

            if (!mediaUrl) {
                console.warn('⚠️ No media URL found in standard fields! Check Evolution API "Save Media" config.');
            }
        }

        if (!text && !mediaType) return res.sendStatus(200);

        // If it's a group, prefix the message with the sender's name for clarity in our dashboard
        if (isGroup) {
            const senderName = msg.pushName || 'Miembro';
            text = `*${senderName}*: ${text}`;
        }

        console.log(`📨 Evolution Msg from ${phone}: ${text}`);

        // Logic from webhooks.js:
        // 1. Get/Create Conversation
        let conversation = await conversationService.getByPhone(phone);
        let isNewConversation = false;

        if (!conversation || nameToUse) {
            // Upsert will now handle default AI settings internally
            // If nameToUse is null, it will keep existing or use placeholder if new
            conversation = await conversationService.upsert(phone, nameToUse);
            isNewConversation = !conversation; // If it didn't exist before the call
            // Refresh conversation object
            conversation = await conversationService.getByPhone(phone);
        }

        const currentState = conversation?.conversation_state || 'ai_active';
        const shouldActivateAI = conversation.ai_enabled !== false;

        // 2. Save Message
        const messageExists = await messageService.existsByWhatsappId(msg.key.id);
        if (messageExists) {
            console.log(`⏭️ Message ${msg.key.id} already exists, skipping save.`);
        } else {
            await messageService.create({
                phone: phone,
                sender: senderType, // Use dynamic sender type (agent or user)
                text: text,
                whatsappId: msg.key.id,
                mediaType: mediaType,
                mediaUrl: mediaUrl
            });
            console.log(`💾 Saved message as '${senderType}' from ${isFromAgent ? 'your phone' : 'client'}`);
        }

        // 3. Update Conversation
        await conversationService.updateLastMessage(phone, text);

        if (!isFromAgent) {
            await conversationService.incrementUnread(phone);
        } else {
            // If message is from agent (own phone), ensure unread is 0
            await conversationService.markAsRead(phone);
        }

        // 4. Emit
        // 4. Emit to Frontend (Socket.IO)
        // 4. Emit to Frontend (Socket.IO)
        emitToConversation(phone, 'new-message', {
            phone: phone,
            contact_name: conversation.contact_name, // Use name from DB, not from agent's pushName
            message: text,
            whatsapp_id: msg.key.id,
            sender_type: senderType, // Use dynamic sender type
            unread: isFromAgent ? 0 : 1, // Explicit unread delta
            timestamp: new Date().toISOString(),
            conversation_state: currentState,
            ai_enabled: shouldActivateAI,
            media_type: mediaType,
            media_url: mediaUrl,
            isNew: isNewConversation
        });

        // 5. AUTO-TRIGGER N8N IF AI IS ENABLED
        // Only trigger AI for messages from CLIENTS, not from agent's phone
        if (shouldActivateAI && !isGroup && !isFromAgent) {
            console.log(`🧠 AI is enabled for ${phone}, triggering N8N...`);

            // Wait for N8N response
            const aiResponseText = await n8nService.triggerAIProcessing({
                phone: phone,
                text: text,
                contactName: pushName,
                mediaType: mediaType,
                mediaUrl: mediaUrl
            });

            if (aiResponseText) {
                console.log(`🤖 AI Response for ${phone}: ${aiResponseText.substring(0, 50)}...`);

                // 1. Send via WhatsApp (Evolution API)
                await evolutionService.sendMessage(phone, aiResponseText);

                // 2. Save in Database
                // Using a temp ID for internal consistency, though Evolution might give us one later in an upsert event.
                // Since this is OUR message, we save it as 'agent' or 'ai'.
                const agentMessageId = `ai-${Date.now()}`;

                await messageService.create({
                    phone: phone,
                    sender: 'ai', // Mark as 'ai' so it gets blue styling
                    text: aiResponseText,
                    whatsappId: agentMessageId,
                    mediaType: null,
                    mediaUrl: null,
                    status: 'delivered'
                });

                // 3. Update Conversation Last Message
                await conversationService.updateLastMessage(phone, aiResponseText);

                // 4. Emit to Frontend
                emitToConversation(phone, 'new-message', {
                    phone: phone,
                    contact_name: pushName,
                    message: aiResponseText,
                    whatsapp_id: agentMessageId,
                    sender: 'ai', // Mark as 'ai' for blue styling
                    timestamp: new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }),
                    conversation_state: currentState,
                    ai_enabled: true
                });

            } else {
                console.log(`⚠️ No response from AI for ${phone}`);
            }

        } else {
            const skipReason = isFromAgent ? 'Message from agent phone' :
                isGroup ? 'Group message' :
                    'AI disabled';
            console.log(`🛑 AI skipped for ${phone} (${skipReason})`);
        }

        return res.json({ success: true });

    } catch (error) {
        console.error('❌ Error processing Evolution webhook:', error);
        return res.sendStatus(500);
    }
});

module.exports = { router, setSocketIO };
