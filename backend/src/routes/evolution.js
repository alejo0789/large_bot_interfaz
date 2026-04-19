/**
 * Evolution API Webhook Routes
 * Handles incoming messages from Evolution API
 */
const express = require('express');
const router = express.Router();
const messageService = require('../services/messageService');
const conversationService = require('../services/conversationService');

const evolutionService = require('../services/whatsappFactory');
const n8nService = require('../services/n8nService');
const settingsService = require('../services/settingsService');
const tagService = require('../services/tagService');
const { saveBase64AsFile } = require('../utils/fileUtils');
const { normalizePhone, getPureDigits } = require('../utils/phoneUtils');
const { tenantContext } = require('../utils/tenantContext');


let io = null;
const setSocketIO = (socketIO) => { io = socketIO; };

// Helper to emit events - MT-AWARE
const emitToConversation = (phone, event, data) => {
    if (!io) return;

    // Get tenant from context
    const context = tenantContext.getStore();
    const tenantSlug = context?.tenant?.slug;

    if (!tenantSlug) {
        console.warn('⚠️ emitToConversation called without tenant context');
        return;
    }

    // Normalize phone to ensure delivery to formatted rooms
    const dbPhone = normalizePhone(phone);
    const purePhone = getPureDigits(phone);

    console.log(`📡 [${tenantSlug}] Emitting ${event} to tenant:${tenantSlug} and conv:${purePhone}`);

    // Emit primary event to both the global tenant room (for sidebar new-message checks) 
    // and the specific conversation room
    io.to(`tenant:${tenantSlug}`).to(`tenant:${tenantSlug}:conv:${purePhone}`).emit(event, data);

    // Also emit the specialized conversation-updated event to the global tenant room
    io.to(`tenant:${tenantSlug}`).emit('conversation-updated', {
        phone: dbPhone,
        lastMessage: data.message,
        timestamp: data.timestamp || new Date().toISOString(),
        contact_name: data.contact_name,
        unread: data.unread !== undefined ? data.unread : 1,
        sender_type: data.sender_type || 'user',
        isNew: data.isNew || false
    });
};

router.post('/', async (req, res) => {
    try {
        const { event, data, instance } = req.body;
        // Handle SYNC Events (MESSAGES_SET, CHATS_SET)
        if (event === 'messages.set' || event === 'MESSAGES_SET') {
            console.log(`📥 [SYNC] Processing batch messages sync for ${instance}... (${data.length} messages)`);
            res.sendStatus(200);

            // Process messages in background to not block webhook
            processBatchMessages(data).catch(err => console.error('❌ Error in batch sync:', err));
            return;
        }

        if (event === 'chats.set' || event === 'CHATS_SET' || event === 'chats.upsert' || event === 'CHATS_UPSERT') {
            console.log(`📥 [SYNC] Processing chats sync for ${instance}...`);
            res.sendStatus(200);
            
            // Process sync in background
            const chats = Array.isArray(data) ? data : [data];
            (async () => {
                for (const chat of chats) {
                    try {
                        const phone = normalizePhone(chat.id || chat.remoteJid);
                        if (phone) {
                            await conversationService.upsert(phone, chat.name || chat.pushName);
                        }
                    } catch (err) {
                        // Silent skip
                    }
                }
            })().catch(err => console.error('❌ Error in background chats sync:', err));
            return;
        }

        if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
            return res.sendStatus(200);
        }

        const msg = data;
        if (!msg || !msg.key) {
            return res.sendStatus(200);
        }

        // ⚡ RESPOND IMMEDIATELY to Evolution API to prevent webhook timeout
        // All processing will happen in the background after this response
        res.json({ success: true });

        // Determine if this message is from the business (agent) or from client (user)
        const isFromAgent = msg.key.fromMe === true;
        const senderType = isFromAgent ? 'agent' : 'user';

        // --- DE-DUPLICATION CHECK ---
        // If this is a message FROM US, check if we just sent it via AI
        if (isFromAgent) {
            const remoteJid = msg.key.remoteJid;
            const phone = normalizePhone(remoteJid);

            // Extract text for matching (support both text and multimedia)
            let textToMatch = '';
            let mediaTypeToMatch = null;

            if (msg.message?.conversation) {
                textToMatch = msg.message.conversation;
            } else if (msg.message?.extendedTextMessage?.text) {
                textToMatch = msg.message.extendedTextMessage.text;
            } else if (msg.message?.imageMessage) {
                textToMatch = msg.message.imageMessage.caption || '';
                mediaTypeToMatch = 'image';
            } else if (msg.message?.videoMessage) {
                textToMatch = msg.message.videoMessage.caption || '';
                mediaTypeToMatch = 'video';
            } else if (msg.message?.audioMessage) {
                textToMatch = '🎤 Nota de voz';
                mediaTypeToMatch = 'audio';
            }

            // Create cache key including media type for multimedia messages
            const cacheKey = mediaTypeToMatch
                ? `${phone}:${mediaTypeToMatch}:${textToMatch.trim()}`
                : `${phone}:${textToMatch.trim()}`;

            if (global.recentAiMessages && global.recentAiMessages.has(cacheKey)) {
                console.log(`♻️ Skipping webhook for recent AI ${mediaTypeToMatch || 'text'} message: ${cacheKey.substring(0, 50)}...`);
                return res.sendStatus(200);
            }
        }

        console.log(`📋 Message Type: ${isFromAgent ? 'FROM AGENT (your phone)' : 'FROM CLIENT'}`);

        // Helper: detect if a string looks like a raw WhatsApp LID (not a real name)
        const looksLikeLid = (str) => {
            if (!str) return true;
            const digits = str.replace(/\D/g, '');
            return digits.length > 10 && (digits.length / str.length) > 0.8;
        };

        const remoteJidOriginal = msg.key.remoteJid;
        let remoteJid = remoteJidOriginal;
        const isGroup = remoteJid.includes('@g.us');

        // Resolve WhatsApp LID (Linked Device) to real phone number if possible
        if (!isGroup) {
            const isLid = remoteJid.includes('@lid') || (remoteJid.split('@')[0].length > 14);
            const altJid = msg.key.remoteJidAlt;
            const participantAlt = msg.key.participantAlt;
            
            const potentialAlt = (altJid && !altJid.includes('@lid') && altJid.includes('@s.whatsapp.net')) ? altJid 
                               : (participantAlt && !participantAlt.includes('@lid') && participantAlt.includes('@s.whatsapp.net')) ? participantAlt 
                               : null;
            
            if (isLid && potentialAlt) {
                console.log(`🔄 [WEBHOOK] LID Resolved: replacing ${remoteJid} with ${potentialAlt}`);
                remoteJid = potentialAlt;
            }
        }

        console.log(`🔍 [WEBHOOK] Processing message from JID: ${remoteJid} (isGroup: ${isGroup})`);

        // Better phone extraction: 
        // 1. If it's a group, keep as is
        // 2. If it ends in @s.whatsapp.net, strip it (normal phone)
        // 3. IF IT HAS ANY OTHER DOMAIN (@lid, @c.us, @newsletter), KEEP IT FULL!
        let phone;
        if (isGroup) {
            phone = remoteJid;
        } else {
            phone = normalizePhone(remoteJid);

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

        // --- ROBUST MESSAGE UNWRAPPING for Text Extraction ---
        let mainMsg = msg.message;
        if (mainMsg?.ephemeralMessage) mainMsg = mainMsg.ephemeralMessage.message;
        if (mainMsg?.viewOnceMessage) mainMsg = mainMsg.viewOnceMessage.message;
        if (mainMsg?.viewOnceMessageV2) mainMsg = mainMsg.viewOnceMessageV2.message;
        if (mainMsg?.documentWithCaptionMessage) mainMsg = mainMsg.documentWithCaptionMessage.message;

        if (mainMsg?.conversation) {
            text = mainMsg.conversation;
        } else if (mainMsg?.extendedTextMessage?.text) {
            text = mainMsg.extendedTextMessage.text;
        } else if (mainMsg?.imageMessage) {
            text = mainMsg.imageMessage.caption || null;
            mediaType = 'image';
            mediaUrl = mainMsg.imageMessage.url;
            mimetype = mainMsg.imageMessage.mimetype || 'image/jpeg';
        } else if (mainMsg?.videoMessage) {
            text = mainMsg.videoMessage.caption || null;
            mediaType = 'video';
            mediaUrl = mainMsg.videoMessage.url;
            mimetype = mainMsg.videoMessage.mimetype || 'video/mp4';
        } else if (mainMsg?.audioMessage) {
            text = null;
            mediaType = 'audio';
            mediaUrl = mainMsg.audioMessage.url;
            mimetype = mainMsg.audioMessage.mimetype || 'audio/ogg; codecs=opus';
        } else if (mainMsg?.documentMessage) {
            text = mainMsg.documentMessage.fileName || '📄 Documento';
            mediaType = 'document';
            mediaUrl = mainMsg.documentMessage.url;
            mimetype = mainMsg.documentMessage.mimetype || 'application/octet-stream';
        } else if (mainMsg?.protocolMessage && mainMsg.protocolMessage.type === "MESSAGE_EDIT") {
            console.log("✏️ [WEBHOOK] Received MESSAGE_EDIT protocol message.");
            const editedMsg = msg.message.protocolMessage;
            const targetId = editedMsg.key.id;
            const newText = editedMsg.editedMessage?.extendedTextMessage?.text || editedMsg.editedMessage?.conversation || "";

            if (newText && targetId) {
                const existingMsg = await messageService.getMessageById(targetId);
                if (existingMsg) {
                    await messageService.updateMessageText(existingMsg.id, newText);
                    if (io) {
                        const context = tenantContext.getStore();
                        const tenantSlug = context?.tenant?.slug;
                        if (tenantSlug) {
                            io.to(`tenant:${tenantSlug}`).to(`tenant:${tenantSlug}:conv:${getPureDigits(phone)}`).emit('message-updated', {
                                id: existingMsg.id,
                                whatsapp_id: targetId,
                                status: existingMsg.status,
                                text: newText,
                                media_url: existingMsg.media_url,
                                media_type: existingMsg.media_type,
                                phone: phone,
                                edited: true
                            });
                        }
                    }
                }
            }
            // Protocol messages (like edit) should NOT be saved as new messages
            return res.sendStatus(200);
        }

        // --- ROBUST MESSAGE UNWRAPPING ---
        // Some messages are wrapped in ephemeralMessage or viewOnceMessage
        let realMessage = msg.message;
        if (realMessage?.ephemeralMessage) realMessage = realMessage.ephemeralMessage.message;
        if (realMessage?.viewOnceMessage) realMessage = realMessage.viewOnceMessage.message;
        if (realMessage?.viewOnceMessageV2) realMessage = realMessage.viewOnceMessageV2.message;
        if (realMessage?.documentWithCaptionMessage) realMessage = realMessage.documentWithCaptionMessage.message;

        // --- REPLY / QUOTED MESSAGE EXTRACTION ---
        let replyToData = null;
        
        // Extract contextInfo: check root and all common message types
        const contextInfo = realMessage?.contextInfo ||
            realMessage?.extendedTextMessage?.contextInfo ||
            realMessage?.imageMessage?.contextInfo ||
            realMessage?.videoMessage?.contextInfo ||
            realMessage?.audioMessage?.contextInfo ||
            realMessage?.documentMessage?.contextInfo ||
            realMessage?.stickerMessage?.contextInfo ||
            realMessage?.buttonsResponseMessage?.contextInfo ||
            realMessage?.templateButtonReplyMessage?.contextInfo ||
            realMessage?.interactiveResponseMessage?.contextInfo ||
            null;

        if (contextInfo?.quotedMessage) {
            let quotedMsg = contextInfo.quotedMessage;
            
            // Unwrap quoted message too if needed
            if (quotedMsg?.ephemeralMessage) quotedMsg = quotedMsg.ephemeralMessage.message;
            if (quotedMsg?.viewOnceMessage) quotedMsg = quotedMsg.viewOnceMessage.message;
            if (quotedMsg?.viewOnceMessageV2) quotedMsg = quotedMsg.viewOnceMessageV2.message;

            const quotedId = contextInfo.stanzaId;
            const quotedText = quotedMsg.conversation ||
                quotedMsg.extendedTextMessage?.text ||
                quotedMsg.imageMessage?.caption ||
                quotedMsg.videoMessage?.caption ||
                (quotedMsg.audioMessage ? '🎤 Nota de voz' : null) ||
                (quotedMsg.stickerMessage ? '🎭 Sticker' : null) ||
                (quotedMsg.documentMessage ? `📄 ${quotedMsg.documentMessage.fileName || 'Documento'}` : null) ||
                '📎 Archivo';

            // Resolve sender name: participant is usually a JID like "573001234567@s.whatsapp.net"
            const senderJid = contextInfo.participant || contextInfo.remoteJid || msg.key.remoteJid || '';
            const senderPhone = senderJid.split('@')[0];

            replyToData = {
                id: quotedId,
                text: quotedText,
                sender: senderPhone || 'Alguien'
            };
            console.log(`💬 Webhook detected REPLY to: ${quotedId} | text: "${quotedText?.substring(0, 40)}" | sender: ${replyToData.sender}`);
        }

        // --- MEDIA HANDLING: BASE64 PRIORITY ---
        // Try to find base64 in common locations (Evolution v1 vs v2)
        let finalBase64 = msg.base64 ||
            (msg.message && msg.message.base64) ||
            (msg.message && msg.message.imageMessage && msg.message.imageMessage.base64) ||
            (msg.message && msg.message.videoMessage && msg.message.videoMessage.base64) ||
            (msg.message && msg.message.audioMessage && msg.message.audioMessage.base64);

        // Fallback: If no base64 in webhook, try to fetch it from Evolution API
        if (!finalBase64 && mediaType) {
            console.log(`⚠️ No base64 in webhook. Attempting to fetch media from Evolution API for [${mediaType}]...`);
            try {
                // Ensure we have a valid fetchBase64 method
                if (typeof evolutionService.fetchBase64 === 'function') {
                    finalBase64 = await evolutionService.fetchBase64(msg);
                    if (finalBase64) {
                        console.log(`✅ Successfully fetched base64 from API! Length: ${finalBase64.length}`);
                    } else {
                        console.warn(`❌ Failed to fetch base64 from API.`);
                    }
                } else {
                    console.warn(`❌ evolutionService.fetchBase64 is not defined! Images will not show.`);
                }
            } catch (errFallback) {
                console.error(`❌ Error in fetchBase64 fallback: ${errFallback.message}`);
            }
        }

        if (finalBase64) {
            console.log(`💎 Base64 Media ready! Saving to persistent storage...`);
            // Ensure we have a mimetype
            const safeMimetype = mimetype || (mediaType === 'image' ? 'image/jpeg' :
                mediaType === 'video' ? 'video/mp4' :
                    mediaType === 'audio' ? 'audio/ogg' : 'application/octet-stream');

            // Save to disk and get public URL
            const savedUrl = await saveBase64AsFile(finalBase64, mediaType, safeMimetype);
            if (savedUrl) {
                mediaUrl = savedUrl;
                console.log(`✅ Media saved to volume: ${mediaUrl}`);
            } else {
                console.warn(`⚠️ Failed to save media to disk, falling back to Data URI (will not persist in volume)`);
                mediaUrl = `data:${safeMimetype};base64,${finalBase64}`;
            }
        } else if (mediaUrl && mediaUrl.includes('whatsapp.net')) {
            console.warn(`⚠️ Warning: Using internal WhatsApp URL which may not be accessible: ${mediaUrl}`);
            // If it's a whatsapp.net URL and we don't have base64, the frontend won't be able to show it
            // We set it to null so the frontend doesn't show a broken image icon
            mediaUrl = null;
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

        // 1. Get/Create Conversation
        let existingConversation = await conversationService.getByPhone(phone);
        let isNewConversation = !existingConversation;
        let conversation = existingConversation;

        if (!conversation || nameToUse) {
            // Upsert will now handle default AI settings internally
            // If nameToUse is null, it will keep existing or use placeholder if new
            conversation = await conversationService.upsert(phone, nameToUse);
            // Refresh conversation object
            conversation = await conversationService.getByPhone(phone);
        }

        const currentState = conversation?.conversation_state || 'ai_active';
        const shouldActivateAI = conversation.ai_enabled !== false;

        // Use pushName only if it looks like a real name (not a LID)
        const cleanSenderName = (!looksLikeLid(msg.pushName) ? msg.pushName : null) ||
            (isFromAgent ? 'Tú' : conversation?.contact_name || 'Cliente');

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
                mediaUrl: mediaUrl,
                senderName: cleanSenderName,
                replyToId: replyToData?.id,
                replyToText: replyToData?.text,
                replyToSender: replyToData?.sender
            });
            console.log(`💾 Saved message as '${senderType}' from ${isFromAgent ? 'your phone' : 'client'}`);
        }

        // 3. Update Conversation (use placeholder if text is null due to media)
        const previewText = text || (
            mediaType === 'image' ? '📷 Imagen' :
                mediaType === 'video' ? '🎥 Video' :
                    mediaType === 'audio' ? '🎵 Audio' : '📎 Archivo'
        );
        await conversationService.updateLastMessage(phone, previewText);

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
            contact_name: conversation.contact_name,
            message: text,
            whatsapp_id: msg.key.id,
            sender: senderType, // Changed from sender_type for consistency
            sender_type: senderType, // Keep for backward compatibility
            sender_name: cleanSenderName,
            agent_name: isFromAgent ? ((!looksLikeLid(msg.pushName) ? msg.pushName : null) || 'Agente') : null,
            unread: isFromAgent ? 0 : 1,
            timestamp: new Date().toISOString(),
            conversation_state: currentState,
            ai_enabled: shouldActivateAI,
            media_type: mediaType,
            media_url: mediaUrl,
            isNew: isNewConversation,
            replyTo: replyToData
        });

        // 5. AUTO-TRIGGER N8N IF AI IS ENABLED
        // Only trigger AI for messages from CLIENTS, not from agent's phone
        if (shouldActivateAI && !isGroup && !isFromAgent) {
            console.log(`🧠 AI is enabled for ${phone}, buffering message for N8N...`);

            if (!global.aiMessageBuffer) {
                global.aiMessageBuffer = new Map();
            }

            let bufferData = global.aiMessageBuffer.get(phone);
            if (!bufferData) {
                bufferData = {
                    messages: [],
                    media: [],
                    timeoutId: null,
                    pushName: pushName,
                    currentState: currentState,
                    context: tenantContext.getStore()
                };
                global.aiMessageBuffer.set(phone, bufferData);
            }

            // Append the new content
            if (text) {
                bufferData.messages.push(text);
            }
            if (mediaUrl) {
                bufferData.media.push({ mediaType, mediaUrl });
            }

            // Update latest metadata
            bufferData.pushName = pushName || bufferData.pushName;
            bufferData.currentState = currentState || bufferData.currentState;

            // Clear previous timeout
            if (bufferData.timeoutId) {
                clearTimeout(bufferData.timeoutId);
            }

            // Set new timeout for 30s
            bufferData.timeoutId = setTimeout(async () => {
                // Remove from buffer when executing
                global.aiMessageBuffer.delete(phone);

                // Run inside the correct tenant context
                tenantContext.run(bufferData.context || {}, async () => {
                    const combinedText = bufferData.messages.join('\n');
                    const lastMedia = bufferData.media.length > 0 ? bufferData.media[bufferData.media.length - 1] : null;

                    console.log(`⏱️ Buffer timeout reached for ${phone}. Sending combined message to N8N (${bufferData.messages.length} messages merged)`);

                    try {
                        // Wait for N8N response
                        const aiResponse = await n8nService.triggerAIProcessing({
                            phone: phone,
                            text: combinedText,
                            contactName: bufferData.pushName,
                            mediaType: lastMedia ? lastMedia.mediaType : null,
                            mediaUrl: lastMedia ? lastMedia.mediaUrl : null
                        });

                        // Extract text from the response object
                        let aiResponseText = null;
                        let intentTag = null; // New intent tag extractor
                        if (aiResponse && typeof aiResponse === 'object') {
                            aiResponseText = aiResponse.text || aiResponse.message || null;
                            intentTag = aiResponse.intent_tag || null;
                        } else if (typeof aiResponse === 'string') {
                            aiResponseText = aiResponse;
                        }

                        // Apply intent tag if provided by AI
                        if (intentTag) {
                            console.log(`🏷️ Lead intent detected from AI: ${intentTag} for ${phone}`);
                            await conversationService.updateLeadIntent(phone, intentTag);
                            // Emit update specifically for the new lead field
                            emitToConversation(phone, 'lead-classification-updated', { 
                                phone, 
                                leadIntent: intentTag 
                            });
                        }

                        if (aiResponseText) {
                            console.log(`🤖 AI Response received for ${phone}:`);
                            console.log(`   Full text length: ${aiResponseText.length} characters`);
                            console.log(`   First 100 chars: ${aiResponseText.substring(0, 100)}`);
                            
                            // --- MULTIMEDIA DETECTION ---
                            const idMatch = aiResponseText.match(/\[ID:\s*([a-f\d-]+)\]/i);
                            let finalMediaUrl = aiResponse?.mediaUrl || null;
                            let finalMediaType = aiResponse?.mediaType || null;
                            let cleanAiText = (aiResponseText || '').replace(/\[ID:\s*[a-f\d-]+\s*\]/gi, '').trim();

                            console.log(`🔎 ID Match result: ${idMatch ? `Found - ${idMatch[1]}` : 'Not found'}`);
                            console.log(`✂️ Clean text (without ID): ${cleanAiText.substring(0, 50)}...`);

                            if (idMatch) {
                                const resourceId = idMatch[1];
                                console.log(`🔍 Resource ID detected in AI response: ${resourceId}`);
                                console.log(`   Querying ai_knowledge table...`);

                                try {
                                    const { pool } = require('../config/database');
                                    const { config } = require('../config/app');
                                    const resourceResult = await pool.query('SELECT id, type, media_url, title FROM ai_knowledge WHERE id = $1', [resourceId]);

                                    console.log(`📊 Query result: ${resourceResult.rows.length} rows found`);

                                    if (resourceResult.rows.length > 0) {
                                        const resource = resourceResult.rows[0];
                                        console.log(`📦 Resource details:`, {
                                            id: resource.id,
                                            type: resource.type,
                                            title: resource.title,
                                            media_url: resource.media_url
                                        });

                                        if (resource.media_url) {
                                            finalMediaUrl = resource.media_url;

                                            if (finalMediaUrl.startsWith('/') && !finalMediaUrl.startsWith('http')) {
                                                const originalUrl = finalMediaUrl;
                                                finalMediaUrl = `${config.publicUrl}${finalMediaUrl}`;
                                            }

                                            let rawType = (resource.type || '').trim().toLowerCase();
                                            const urlLower = finalMediaUrl.toLowerCase();

                                            if (!rawType || rawType === 'text') {
                                                if (urlLower.match(/\.(jpg|jpeg|png|gif|webp)$/)) rawType = 'image';
                                                else if (urlLower.match(/\.(mp4|avi|mov)$/)) rawType = 'video';
                                                else if (urlLower.match(/\.(mp3|ogg|wav)$/)) rawType = 'audio';
                                                else if (urlLower.match(/\.(pdf|doc|docx|xls|xlsx)$/)) rawType = 'document';
                                            }

                                            const allowedTypes = ['image', 'video', 'audio', 'document'];
                                            if (allowedTypes.includes(rawType)) {
                                                finalMediaType = rawType;
                                            } else {
                                                if (urlLower.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
                                                    finalMediaType = 'image';
                                                } else {
                                                    console.warn(`⚠️ Unknown media type '${rawType}' and no extension match, defaulting to 'document'`);
                                                    finalMediaType = 'document';
                                                }
                                            }

                                            console.log(`✅ Media will be sent!`);
                                            console.log(`   URL: ${finalMediaUrl}`);
                                        } else {
                                            console.warn(`⚠️ Resource found but media_url is empty/null`);
                                        }
                                    } else {
                                        console.warn(`⚠️ Resource ID ${resourceId} NOT FOUND in ai_knowledge table`);
                                    }
                                } catch (dbErr) {
                                    console.error('❌ Error fetching resource from DB:', dbErr.message);
                                }
                            } else {
                                console.log(`ℹ️ No [ID: ...] pattern found in AI response, sending as text only`);
                            }

                            // --- DE-DUPLICATION CACHE ---
                            if (!global.recentAiMessages) global.recentAiMessages = new Set();
                            const cacheKey = finalMediaType
                                ? `${phone}:${finalMediaType}:${cleanAiText.trim()}`
                                : `${phone}:${aiResponseText.trim()}`;

                            global.recentAiMessages.add(cacheKey);
                            setTimeout(() => global.recentAiMessages.delete(cacheKey), 30000);

                            // 1. Send via WhatsApp
                            console.log(`\n📨 STEP 1: Sending to WhatsApp`);
                            let sendingResult = { success: false };

                            if (finalMediaUrl) {
                                console.log(`   Mode: MULTIMEDIA (${finalMediaType})`);
                                sendingResult = await evolutionService.sendMedia(getPureDigits(phone), finalMediaUrl, finalMediaType, cleanAiText);

                                if (sendingResult.success) {
                                    console.log(`   ✅ Multimedia message sent successfully`);
                                } else {
                                    console.error(`   ❌ Failed to send multimedia message:`, sendingResult.error);
                                    console.log(`   ⚠️ Fallback: Reverting to TEXT ONLY`);

                                    const fallbackText = `${cleanAiText}\n\n📷 ${finalMediaUrl}`;
                                    sendingResult = await evolutionService.sendMessage(getPureDigits(phone), fallbackText);

                                    finalMediaType = null;
                                    finalMediaUrl = null;
                                    cleanAiText = fallbackText;
                                }
                            } else {
                                console.log(`   Mode: TEXT ONLY`);
                                sendingResult = await evolutionService.sendMessage(getPureDigits(phone), aiResponseText);
                            }

                            // 2. Save in Database
                            console.log(`\n💾 STEP 2: Saving to Database`);
                            const agentMessageId = `ai-${Date.now()}`;
                            const dbText = cleanAiText || (finalMediaUrl ? (finalMediaType === 'image' ? '📷 Imagen' : '📎 Archivo') : '...');

                            await messageService.create({
                                phone: phone,
                                sender: 'ai',
                                text: dbText,
                                whatsappId: agentMessageId,
                                mediaType: finalMediaType,
                                mediaUrl: finalMediaUrl,
                                status: 'delivered',
                                senderName: 'Inteligencia Artificial'
                            });

                            // 3. Update Conversation Last Message
                            console.log(`\n🔄 STEP 3: Updating conversation`);
                            await conversationService.updateLastMessage(phone, dbText);
                            await conversationService.markAsRead(phone);

                            // 4. Emit to Frontend
                            console.log(`\n📡 STEP 4: Emitting to Frontend`);
                            const frontendPayload = {
                                phone: phone,
                                contact_name: bufferData.pushName, // Get from buffer
                                message: dbText,
                                whatsapp_id: agentMessageId,
                                sender: 'ai',
                                sender_name: 'Inteligencia Artificial',
                                timestamp: new Date().toISOString(),
                                conversation_state: bufferData.currentState, // Get from buffer
                                ai_enabled: true,
                                media_type: finalMediaType,
                                media_url: finalMediaUrl
                            };
                            emitToConversation(phone, 'new-message', frontendPayload);
                            console.log(`   ✅ Message emitted to frontend\n`);

                        } else {
                            console.log(`⚠️ No response from AI for ${phone}`);
                        }
                    } catch (aiErr) {
                        console.error(`❌ Error in buffered AI run for ${phone}:`, aiErr);
                    }
                });
            }, 30000); // 30 seconds buffer


        } else {
            const skipReason = isFromAgent ? 'Message from agent phone' :
                isGroup ? 'Group message' :
                    'AI disabled';
            console.log(`🛑 AI skipped for ${phone} (${skipReason})`);
        }

        // Response was already sent at the top (non-blocking)
        return;

    } catch (error) {
        console.error('❌ Error processing Evolution webhook:', error);
        // Response was already sent, so we can only log the error
        // If res was not sent yet (early errors before the res.json), send 500
        if (!res.headersSent) {
            return res.sendStatus(500);
        }
    }
});

/**
 * Process a batch of messages (from MESSAGES_SET)
 */
async function processBatchMessages(messages) {
    if (!Array.isArray(messages)) return;

    console.log(`🚀 Processing ${messages.length} messages from sync...`);

    // Sort by timestamp if available to process in order
    const sorted = messages.sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0));

    for (const msg of sorted) {
        try {
            const remoteJid = msg.key.remoteJid;
            const phone = normalizePhone(remoteJid);
            if (!phone) continue;

            const isFromAgent = msg.key.fromMe === true;
            const senderType = isFromAgent ? 'agent' : 'user';

            // Extract basic text
            let text = '';
            if (msg.message?.conversation) text = msg.message.conversation;
            else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
            else if (msg.message?.imageMessage?.caption) text = msg.message.imageMessage.caption;
            else if (msg.message?.videoMessage?.caption) text = msg.message.videoMessage.caption;

            if (!text && !msg.message?.imageMessage && !msg.message?.videoMessage && !msg.message?.audioMessage) continue;

            // Check if exists
            const exists = await messageService.existsByWhatsappId(msg.key.id);
            if (exists) continue;

            // Upsert conversation
            await conversationService.upsert(phone, msg.pushName);

            // Extract quoted/reply data from contextInfo (same logic as live webhook)
            let batchReplyToData = null;
            const batchContextInfo = msg.message?.extendedTextMessage?.contextInfo ||
                msg.message?.imageMessage?.contextInfo ||
                msg.message?.videoMessage?.contextInfo ||
                msg.message?.audioMessage?.contextInfo ||
                msg.message?.documentMessage?.contextInfo ||
                null;

            if (batchContextInfo?.quotedMessage) {
                const quotedMsg = batchContextInfo.quotedMessage;
                const batchQuotedText = quotedMsg.conversation ||
                    quotedMsg.extendedTextMessage?.text ||
                    quotedMsg.imageMessage?.caption ||
                    quotedMsg.videoMessage?.caption ||
                    (quotedMsg.audioMessage ? '🎤 Nota de voz' : null) ||
                    (quotedMsg.documentMessage ? `📄 ${quotedMsg.documentMessage.fileName || 'Documento'}` : null) ||
                    '📎 Archivo';
                const batchSenderJid = batchContextInfo.participant || batchContextInfo.remoteJid || '';
                batchReplyToData = {
                    id: batchContextInfo.stanzaId,
                    text: batchQuotedText,
                    sender: batchSenderJid.split('@')[0] || 'Alguien'
                };
            }

            // Save message
            await messageService.create({
                phone: phone,
                sender: senderType,
                text: text || (msg.message?.imageMessage ? '📷 Imagen' : '📎 Archivo'),
                whatsappId: msg.key.id,
                senderName: msg.pushName || (isFromAgent ? 'Tú' : 'Cliente'),
                timestamp: msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000).toISOString() : null,
                replyToId: batchReplyToData?.id,
                replyToText: batchReplyToData?.text,
                replyToSender: batchReplyToData?.sender
            });

            // Update last message (only if it's the newest)
            await conversationService.updateLastMessage(phone, text || 'Archivo');
        } catch (err) {
            // Silently fail individual messages in batch
        }
    }
    console.log(`✅ Batch sync completed.`);
}

module.exports = { router, setSocketIO };
