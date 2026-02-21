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
const { saveBase64AsFile } = require('../utils/fileUtils');

let io = null;
const setSocketIO = (socketIO) => { io = socketIO; };

// Helper to emit events - NORMALIZED phone handling
const emitToConversation = (phone, event, data) => {
    if (!io) return;

    // Normalize phone to ensure delivery to both formats (+57... and 57...)
    const purePhone = String(phone).replace(/\D/g, '');
    const dbPhone = purePhone.startsWith('57') ? `+${purePhone}` : purePhone;

    console.log(`📡 Emitting ${event} to conversation:${dbPhone} (also ${purePhone})`);

    // Emit to conversation room with + (DB format)
    io.to(`conversation:${dbPhone}`).emit(event, data);

    // Emit to conversation room without + (pure format, in case frontend joined with that)
    if (dbPhone !== purePhone) {
        io.to(`conversation:${purePhone}`).emit(event, data);
    }

    // Also emit to conversations:list to update sidebar in real-time
    io.to('conversations:list').emit('conversation-updated', {
        phone: dbPhone,
        lastMessage: data.message,
        timestamp: data.timestamp || new Date().toISOString(),
        contact_name: data.contact_name,
        unread: data.unread !== undefined ? data.unread : 1,
        sender_type: data.sender_type || 'user',
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
            const numeric = remoteJid.split('@')[0].replace(/\D/g, '');
            const phone = (numeric.startsWith('57')) ? `+${numeric}` : numeric;

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
            text = msg.message.imageMessage.caption || null;
            mediaType = 'image';
            mediaUrl = msg.message.imageMessage.url;
            mimetype = msg.message.imageMessage.mimetype || 'image/jpeg';
        } else if (msg.message.videoMessage) {
            text = msg.message.videoMessage.caption || null;
            mediaType = 'video';
            mediaUrl = msg.message.videoMessage.url;
            mimetype = msg.message.videoMessage.mimetype || 'video/mp4';
        } else if (msg.message.audioMessage) {
            text = null;
            mediaType = 'audio';
            mediaUrl = msg.message.audioMessage.url;
            mimetype = msg.message.audioMessage.mimetype || 'audio/ogg; codecs=opus';
        } else if (msg.message.documentMessage) {
            text = msg.message.documentMessage.fileName || '📄 Documento';
            mediaType = 'document';
            mediaUrl = msg.message.documentMessage.url;
            mimetype = msg.message.documentMessage.mimetype || 'application/octet-stream';
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
                mediaUrl: mediaUrl,
                senderName: msg.pushName || (isFromAgent ? 'Tú' : 'Cliente')
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
            sender_name: msg.pushName || (isFromAgent ? 'Tú' : 'Cliente'),
            agent_name: isFromAgent ? (msg.pushName || 'Agente') : null,
            unread: isFromAgent ? 0 : 1,
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
            // n8nService.triggerAIProcessing returns an OBJECT: { text, mediaUrl, mediaType, raw }
            const aiResponse = await n8nService.triggerAIProcessing({
                phone: phone,
                text: text,
                contactName: pushName,
                mediaType: mediaType,
                mediaUrl: mediaUrl
            });

            // Extract text from the response object
            let aiResponseText = null;
            if (aiResponse && typeof aiResponse === 'object') {
                aiResponseText = aiResponse.text || aiResponse.message || null;
            } else if (typeof aiResponse === 'string') {
                aiResponseText = aiResponse;
            }

            if (aiResponseText) {
                console.log(`🤖 AI Response received for ${phone}:`);
                console.log(`   Full text length: ${aiResponseText.length} characters`);
                console.log(`   First 100 chars: ${aiResponseText.substring(0, 100)}`);
                console.log(`   Last 100 chars: ${aiResponseText.substring(aiResponseText.length - 100)}`);

                // --- MULTIMEDIA DETECTION ---
                // Check if the response contains an ID reference: [ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx]
                const idMatch = aiResponseText.match(/\[ID:\s*([a-f\d-]+)\]/i);
                let finalMediaUrl = aiResponse.mediaUrl || null;
                let finalMediaType = aiResponse.mediaType || null;
                let cleanAiText = aiResponseText.replace(/\[ID:\s*[a-f\d-]+\s*\]/gi, '').trim();

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

                                // Convert relative URLs to absolute URLs
                                if (finalMediaUrl.startsWith('/') && !finalMediaUrl.startsWith('http')) {
                                    const originalUrl = finalMediaUrl;
                                    finalMediaUrl = `${config.publicUrl}${finalMediaUrl}`;
                                    console.log(`🔄 URL conversion:`);
                                    console.log(`   From: ${originalUrl}`);
                                    console.log(`   To: ${finalMediaUrl}`);
                                }

                                // Validate and normalize media type based on DB type AND URL extension
                                let rawType = (resource.type || '').trim().toLowerCase();
                                const urlLower = finalMediaUrl.toLowerCase();

                                // If type is 'text' or empty, try to infer from URL
                                if (!rawType || rawType === 'text') {
                                    if (urlLower.match(/\.(jpg|jpeg|png|gif|webp)$/)) rawType = 'image';
                                    else if (urlLower.match(/\.(mp4|avi|mov)$/)) rawType = 'video';
                                    else if (urlLower.match(/\.(mp3|ogg|wav)$/)) rawType = 'audio';
                                    else if (urlLower.match(/\.(pdf|doc|docx|xls|xlsx)$/)) rawType = 'document';
                                }

                                // Allowed types
                                const allowedTypes = ['image', 'video', 'audio', 'document'];
                                if (allowedTypes.includes(rawType)) {
                                    finalMediaType = rawType;
                                } else {
                                    // Final check: is it an image URL?
                                    if (urlLower.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
                                        finalMediaType = 'image';
                                    } else {
                                        console.warn(`⚠️ Unknown media type '${rawType}' and no extension match, defaulting to 'document'`);
                                        finalMediaType = 'document';
                                    }
                                }

                                console.log(`✅ Media will be sent!`);
                                console.log(`   Original Type: ${resource.type}`);
                                console.log(`   Inferred Type: ${finalMediaType}`);
                                console.log(`   URL: ${finalMediaUrl}`);
                            } else {
                                console.warn(`⚠️ Resource found but media_url is empty/null`);
                            }
                        } else {
                            console.warn(`⚠️ Resource ID ${resourceId} NOT FOUND in ai_knowledge table`);
                        }
                    } catch (dbErr) {
                        console.error('❌ Error fetching resource from DB:');
                        console.error(`   Message: ${dbErr.message}`);
                        console.error(`   Stack: ${dbErr.stack}`);
                    }
                } else {
                    console.log(`ℹ️ No [ID: ...] pattern found in AI response, sending as text only`);
                }

                // --- DE-DUPLICATION CACHE ---
                // Store the content to ignore the next webhook confirmation
                if (!global.recentAiMessages) global.recentAiMessages = new Set();

                // Use same cache key format as the deduplication check
                const cacheKey = finalMediaType
                    ? `${phone}:${finalMediaType}:${cleanAiText.trim()}`
                    : `${phone}:${aiResponseText.trim()}`;

                global.recentAiMessages.add(cacheKey);
                setTimeout(() => global.recentAiMessages.delete(cacheKey), 30000);

                // 1. Send via WhatsApp (Evolution API)
                console.log(`\n📨 STEP 1: Sending to WhatsApp`);
                let sendingResult = { success: false };

                if (finalMediaUrl) {
                    console.log(`   Mode: MULTIMEDIA (${finalMediaType})`);
                    console.log(`   Media URL: ${finalMediaUrl}`);
                    console.log(`   Caption: ${cleanAiText.substring(0, 50)}...`);

                    sendingResult = await evolutionService.sendMedia(phone, finalMediaUrl, finalMediaType, cleanAiText);

                    if (sendingResult.success) {
                        console.log(`   ✅ Multimedia message sent successfully`);
                        // Keep finalMediaType and finalMediaUrl as is
                    } else {
                        console.error(`   ❌ Failed to send multimedia message with all strategies:`, sendingResult.error);
                        console.log(`   ⚠️ Fallback: Reverting to TEXT ONLY mode for DB and Frontend`);

                        // Fallback: Send text with URL appended
                        const fallbackText = `${cleanAiText}\n\n📷 ${finalMediaUrl}`;
                        sendingResult = await evolutionService.sendMessage(phone, fallbackText);

                        // UPDATE VARIABLES FOR DB/FRONTEND TO MATCH REALITY
                        // We failed to send media, so we shouldn't claim we did in the DB
                        finalMediaType = null;
                        finalMediaUrl = null;
                        cleanAiText = fallbackText; // Update text to include the URL

                        if (sendingResult && sendingResult.success) {
                            console.log(`   ✅ Fallback text message sent successfully`);
                        } else {
                            console.error(`   ❌ Failed to send fallback text message`);
                        }
                    }
                } else {
                    console.log(`   Mode: TEXT ONLY`);
                    console.log(`   Text: ${aiResponseText.substring(0, 50)}...`);
                    sendingResult = await evolutionService.sendMessage(phone, aiResponseText);
                    if (sendingResult && sendingResult.success) {
                        console.log(`   ✅ Text message sent successfully`);
                    } else {
                        console.error(`   ❌ Failed to send text message`);
                    }
                }

                // 2. Save in Database
                console.log(`\n💾 STEP 2: Saving to Database`);
                const agentMessageId = `ai-${Date.now()}`;
                const dbText = cleanAiText || (finalMediaUrl ? (finalMediaType === 'image' ? '📷 Imagen' : '📎 Archivo') : '...');

                console.log(`   Message ID: ${agentMessageId}`);
                console.log(`   Text to save: ${dbText.substring(0, 50)}...`);
                console.log(`   Media Type: ${finalMediaType || 'null'}`);
                console.log(`   Media URL: ${finalMediaUrl || 'null'}`);

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
                console.log(`   ✅ Message saved to database`);

                // 3. Update Conversation Last Message
                console.log(`\n🔄 STEP 3: Updating conversation`);
                await conversationService.updateLastMessage(phone, dbText);
                await conversationService.markAsRead(phone);
                console.log(`   ✅ Conversation updated`);

                // 4. Emit to Frontend
                console.log(`\n📡 STEP 4: Emitting to Frontend`);
                const frontendPayload = {
                    phone: phone,
                    contact_name: conversation?.contact_name || pushName,
                    message: dbText,
                    whatsapp_id: agentMessageId,
                    sender: 'ai',
                    sender_name: 'Inteligencia Artificial',
                    timestamp: new Date().toISOString(),
                    conversation_state: currentState,
                    ai_enabled: true,
                    media_type: finalMediaType,
                    media_url: finalMediaUrl
                };
                console.log(`   Payload:`, JSON.stringify(frontendPayload, null, 2));
                emitToConversation(phone, 'new-message', frontendPayload);
                console.log(`   ✅ Message emitted to frontend\n`);

            } else {
                console.log(`⚠️ No response from AI for ${phone}`);
            }

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

module.exports = { router, setSocketIO };
