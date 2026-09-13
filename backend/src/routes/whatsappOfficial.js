/**
 * Official WhatsApp API Webhook Routes
 * Handles incoming messages from Meta Graph API
 */
const express = require('express');
const router = express.Router();
const messageService = require('../services/messageService');
const conversationService = require('../services/conversationService');
const whatsappFactory = require('../services/whatsappFactory');
const n8nService = require('../services/n8nService');
const { pool } = require('../config/database');
const { normalizePhone, getPureDigits } = require('../utils/phoneUtils');
const { tenantContext } = require('../utils/tenantContext');

let io = null;
const setSocketIO = (socketIO) => { io = socketIO; };

// Helper to emit events - MT-AWARE
const emitToConversation = (phone, event, data) => {
    if (!io) return;

    const context = tenantContext.getStore();
    const tenantSlug = context?.tenant?.slug;

    if (!tenantSlug) {
        console.warn('⚠️ emitToConversation called without tenant context');
        return;
    }

    const dbPhone = normalizePhone(phone);
    const purePhone = getPureDigits(phone);

    io.to(`tenant:${tenantSlug}:conversation:${purePhone}`).emit(event, data);

    io.to(`tenant:${tenantSlug}:conversations:list`).emit('conversation-updated', {
        phone: dbPhone,
        lastMessage: data.message,
        timestamp: data.timestamp,
        contact_name: data.contact_name,
        unread: data.unread !== undefined ? data.unread : 1,
        isNew: data.isNew || false
    });
};

/**
 * Validates the webhook with Meta (Challenge validation)
 */
router.get('/', (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        const context = tenantContext.getStore();
        const tenant = context?.tenant;

        if (!tenant || !tenant.wa_verify_token) {
            console.warn('⚠️ Webhook verification failed: Tenant or wa_verify_token not found');
            return res.sendStatus(403);
        }

        if (mode && token) {
            if (mode === 'subscribe' && token === tenant.wa_verify_token) {
                console.log(`✅ Webhook verified successfully for tenant ${tenant.slug}`);
                return res.status(200).send(challenge);
            } else {
                return res.sendStatus(403);
            }
        }

        res.status(400).send('Bad Request');
    } catch (error) {
        console.error('❌ Webhook verification error:', error);
        res.sendStatus(500);
    }
});

/**
 * Handles incoming messages/statuses from Meta Official API
 */
router.post('/', async (req, res) => {
    try {
        let body = req.body;

        // Check if this is an event from a WhatsApp API
        if (body.object !== 'whatsapp_business_account') {
            return res.sendStatus(404);
        }

        const context = tenantContext.getStore();
        const tenant = context?.tenant;

        // Meta puede enviar varias entradas/cambios y varios mensajes o estados
        // en una sola notificacion. Procesar solo [0] deja mensajes fuera del CRM.
        const entries = Array.isArray(body.entry) ? body.entry : [];

        if (entries.length === 0) {
            return res.sendStatus(200); // Nothing to process
        }

        for (const entry of entries) {
            const changes = Array.isArray(entry?.changes) ? entry.changes : [];

            for (const change of changes) {
                const value = change?.value;
                if (!value) continue;

        // ──────────────────────────────────────────────
        // INCOMING MESSAGE
        // ──────────────────────────────────────────────
        if (Array.isArray(value.messages) && value.messages.length > 0) {
            for (const messageObj of value.messages) {
            // El nombre es informativo; el destinatario/remitente real es message.from.
            // Buscar por wa_id evita asociar el nombre de otro contacto del lote.
            const contactObj = value.contacts?.find(contact => contact.wa_id === messageObj.from)
                || value.contacts?.[0]
                || null;

            const phone = messageObj.from || contactObj?.wa_id || value.contacts?.[0]?.wa_id || null;
            const metaUserId = messageObj.from_user_id || contactObj?.user_id || null;
            const conversationIdentifier = phone || metaUserId;
            if (!conversationIdentifier) {
                console.warn('⚠️ [OfficialWebk] Message received without valid phone/from number, skipping.');
                continue;
            }

            const whatsapp_id = messageObj.id;
            const contact_name = contactObj?.profile?.name || `Usuario ${String(conversationIdentifier).slice(-4)}`;
            const timestamp = new Date(parseInt(messageObj.timestamp) * 1000).toISOString();

            let messageText = '';
            let mediaUrl = null;
            let mediaType = null;
            let mimeType = null;
            let mediaId = null;

            // ── Parse by message type ──
            switch (messageObj.type) {
                case 'text':
                    messageText = messageObj.text.body;
                    break;

                case 'image':
                    mediaId = messageObj.image.id;
                    mimeType = messageObj.image.mime_type;
                    mediaType = 'image';
                    messageText = messageObj.image.caption || '📷 Imagen';
                    break;

                case 'video':
                    mediaId = messageObj.video.id;
                    mimeType = messageObj.video.mime_type;
                    mediaType = 'video';
                    messageText = messageObj.video.caption || '🎥 Video';
                    break;

                case 'audio':
                    mediaId = messageObj.audio.id;
                    mimeType = messageObj.audio.mime_type;
                    mediaType = 'audio';
                    messageText = '🎤 Audio';
                    break;

                case 'document':
                    mediaId = messageObj.document.id;
                    mimeType = messageObj.document.mime_type;
                    mediaType = 'document';
                    messageText = messageObj.document.filename || '📎 Documento';
                    break;

                case 'sticker':
                    mediaId = messageObj.sticker.id;
                    mimeType = messageObj.sticker.mime_type;
                    mediaType = 'image';
                    messageText = '🏷️ Sticker';
                    break;

                case 'location':
                    messageText = `📍 Ubicación: ${messageObj.location.latitude}, ${messageObj.location.longitude}`;
                    break;

                case 'reaction':
                    // Reaction to a previous message — store it and emit
                    console.log(`👍 [OfficialWebk] Reaction received: "${messageObj.reaction.emoji}" on msgId=${messageObj.reaction.message_id}`);
                    // TODO: update DB reaction on the target message
                    continue;

                default:
                    messageText = (() => {
                        if (messageObj.type === 'button') {
                            return messageObj.button?.text || messageObj.button?.payload || 'Button Clicked';
                        }
                        if (messageObj.type === 'interactive') {
                            if (messageObj.interactive?.type === 'button_reply') {
                                return messageObj.interactive.button_reply?.title || 'Button Clicked';
                            } else if (messageObj.interactive?.type === 'list_reply') {
                                return messageObj.interactive.list_reply?.title || 'List Option Clicked';
                            }
                            return 'Interactive Response';
                        }
                        return `[Tipo de mensaje no soportado: ${messageObj.type}]`;
                    })();
            }

            // Check if message came from a Click-to-WhatsApp ad referral
            if (messageObj.referral) {
                try {
                    const ref = messageObj.referral;
                    const source = ref.source_type === 'ad' ? 'Anuncio FB/IG' : (ref.source_type === 'post' ? 'Post FB/IG' : ref.source_type || 'Origen');
                    const headline = ref.headline ? `: "${ref.headline}"` : '';
                    
                    let refInfo = `📢 [${source}${headline}]`;
                    
                    if (ref.source_url) {
                        refInfo += `\n🔗 Link campaña: ${ref.source_url}`;
                    }
                    
                    if (ref.image_url || ref.video_url) {
                        const mediaLink = ref.image_url || ref.video_url;
                        refInfo += `\n🖼️ Medio original: ${mediaLink}`;
                        
                        if (!mediaUrl && !mediaId) {
                            mediaUrl = mediaLink;
                            mediaType = ref.media_type === 'video' ? 'video' : 'image';
                        }
                    }
                    
                    messageText = `${refInfo}\n\n${messageText}`;
                } catch (refErr) {
                    console.error('Error parsing message referral info:', refErr.message);
                }
            }

            console.log(`📱 [OfficialWebk] MSG from: ${phone} | Name: ${contact_name} | Type: ${messageObj.type} | "${messageText.substring(0, 40)}"`);

            // ── Avoid duplicate processing ──
            const exists = await messageService.existsByWhatsappId(whatsapp_id);
            if (exists) {
                console.log(`⏭️ [OfficialWebk] Duplicate message ${whatsapp_id}, skipping.`);
                continue;
            }

            // ── Download incoming media from Meta servers ──
            if (mediaId && tenant) {
                const officialService = require('../services/whatsappOfficialService');
                const localUrl = await officialService.downloadMedia(mediaId, tenant.slug, mimeType);
                if (localUrl) {
                    mediaUrl = localUrl;
                    console.log(`📦 [OfficialWebk] Media saved locally: ${localUrl}`);
                } else {
                    // Fallback: store the meta media ID prefixed so frontend knows to handle it
                    mediaUrl = `meta:${mediaId}`;
                    console.warn(`⚠️ [OfficialWebk] Media download failed — storing meta ID as fallback`);
                }
            }

            const dbPhone = normalizePhone(conversationIdentifier);

            // ── Get or create conversation ──
            let conversation = await conversationService.getByPhone(dbPhone);
            let isNewConversation = false;

            if (!conversation) {
                conversation = await conversationService.upsert(dbPhone, contact_name, 'whatsapp_official');
                isNewConversation = true;
            } else if (!conversation.contact_name || conversation.contact_name === `Usuario ${dbPhone.slice(-4)}`) {
                await conversationService.updateContactName(dbPhone, contact_name);
            }

            // Guardar el identificador de usuario de Meta cuando exista. Es
            // necesario para responder con `recipient` si Meta no entrega phone.
            if (metaUserId) {
                try {
                    await pool.query(`
                        UPDATE conversations
                        SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
                            updated_at = NOW()
                        WHERE phone = $2
                    `, [JSON.stringify({ meta_user_id: metaUserId }), dbPhone]);
                } catch (metadataError) {
                    console.warn(`⚠️ [OfficialWebk] No se pudo guardar meta_user_id para ${dbPhone}:`, metadataError.message);
                }
            }

            const currentState = conversation?.conversation_state || 'ai_active';
            const shouldActivateAI = conversation.ai_enabled !== false;

            // ── Save message to database ──
            await messageService.create({
                phone: dbPhone,
                sender: 'user',
                text: messageText,
                whatsappId: whatsapp_id,
                mediaType,
                mediaUrl,
                timestamp
            });

            // ── Auto-mark campaign reply (non-blocking) ──
            try {
                const ctx = tenantContext.getStore();
                if (ctx?.db) {
                    ctx.db.query(`
                        UPDATE bulk_campaign_recipients 
                        SET status = 'replied', replied_at = NOW()
                        WHERE phone = $1 AND status = 'sent'
                    `, [dbPhone]).catch(() => {});
                }
            } catch (_) {}

            // ── Update conversation counters ──
            await conversationService.updateLastMessage(dbPhone, messageText);
            await conversationService.incrementUnread(dbPhone);

            // ── Forward to n8n for AI processing if enabled ──
            if (shouldActivateAI && currentState === 'ai_active') {
                try {
                    if (tenant?.n8n_webhook_url) {
                        console.log(`🤖 [OfficialWebk] AI enabled for ${dbPhone}, buffering message for N8N...`);

                        if (!global.officialAiBuffer) {
                            global.officialAiBuffer = new Map();
                        }

                        let bufferData = global.officialAiBuffer.get(dbPhone);
                        if (!bufferData) {
                            bufferData = {
                                messages: [],
                                media: [],
                                timeoutId: null,
                                pushName: contact_name,
                                metaUserId,
                                context: tenantContext.getStore()
                            };
                            global.officialAiBuffer.set(dbPhone, bufferData);
                        }

                        // Append the new content
                        if (messageText) {
                            bufferData.messages.push(messageText);
                        }
                        
                        const actualMediaType = messageObj.referral ? null : mediaType;
                        const actualMediaUrl = messageObj.referral ? null : mediaUrl;
                        if (actualMediaUrl) {
                            bufferData.media.push({ mediaType: actualMediaType, mediaUrl: actualMediaUrl });
                        }

                        bufferData.pushName = contact_name || bufferData.pushName;
                        bufferData.metaUserId = metaUserId || bufferData.metaUserId;

                        // Clear previous timeout
                        if (bufferData.timeoutId) {
                            clearTimeout(bufferData.timeoutId);
                        }

                        // Set new timeout for 30s
                        bufferData.timeoutId = setTimeout(async () => {
                            // Remove from buffer when executing
                            global.officialAiBuffer.delete(dbPhone);

                            // Run inside the correct tenant context
                            tenantContext.run(bufferData.context || {}, async () => {
                                const combinedText = bufferData.messages.join('\n');
                                const lastMedia = bufferData.media.length > 0 ? bufferData.media[bufferData.media.length - 1] : null;

                                console.log(`⏱️ [OfficialWebk] Buffer timeout reached for ${dbPhone}. Sending combined message to N8N (${bufferData.messages.length} messages merged)`);

                                try {
                                    await n8nService.triggerAIProcessing({
                                        phone: dbPhone,
                                        text: combinedText,
                                        contactName: bufferData.pushName,
                                        recipientId: bufferData.metaUserId,
                                        mediaType: lastMedia ? lastMedia.mediaType : null,
                                        mediaUrl: lastMedia ? lastMedia.mediaUrl : null
                                    });
                                } catch (aiErr) {
                                    console.error(`❌ [OfficialWebk] Error in buffered AI run for ${dbPhone}:`, aiErr);
                                }
                            });
                        }, 30000); // 30 seconds buffer
                        
                    } else {
                        console.warn(`⚠️ [OfficialWebk] No n8n_webhook_url for tenant ${tenant?.slug}`);
                    }
                } catch (n8nErr) {
                    console.error('❌ [OfficialWebk] Error forwarding to n8n:', n8nErr.message);
                }
            }

            // ── Emit to frontend via Socket.IO ──
            emitToConversation(dbPhone, 'new-message', {
                phone: dbPhone,
                contact_name,
                message: messageText,
                whatsapp_id,
                sender_type: 'user',
                media_type: mediaType,
                media_url: mediaUrl,
                sender_name: contact_name,
                unread: 1,
                timestamp,
                conversation_state: currentState,
                ai_enabled: shouldActivateAI,
                isNew: isNewConversation
            });
            }

        // ──────────────────────────────────────────────
        // MESSAGE STATUS UPDATE (sent/delivered/read)
        // ──────────────────────────────────────────────
        }

        if (Array.isArray(value.statuses) && value.statuses.length > 0) {
            for (const statusObj of value.statuses) {
            console.log(`📊 [OfficialWebk] Status: ${statusObj.id} → ${statusObj.status} for ${statusObj.recipient_id}`);
            if (statusObj.status === 'failed') {
                console.error(`❌ [OfficialWebk] Message delivery failed. Error details:`, JSON.stringify(statusObj.errors || statusObj));
            }

            await messageService.updateStatus(statusObj.id, statusObj.status);

            // Emit status to frontend so tick icons update in real time
            if (io) {
                const context = tenantContext.getStore();
                const tenantSlug = context?.tenant?.slug;
                const recipientPhone = statusObj.recipient_id ? normalizePhone(statusObj.recipient_id) : null;
                const purePhone = statusObj.recipient_id ? getPureDigits(statusObj.recipient_id) : null;

                const eventPayload = {
                    id: statusObj.id,
                    whatsapp_id: statusObj.id,
                    status: statusObj.status,
                    phone: recipientPhone
                };

                if (tenantSlug) {
                    io.to(`tenant:${tenantSlug}`)
                      .to(`tenant:${tenantSlug}:conversations:list`)
                      .to(`tenant:${tenantSlug}:conversation:${purePhone}`)
                      .emit('message-status-update', eventPayload);

                    io.to(`tenant:${tenantSlug}`)
                      .to(`tenant:${tenantSlug}:conversations:list`)
                      .to(`tenant:${tenantSlug}:conversation:${purePhone}`)
                      .emit('message-updated', eventPayload);
                } else {
                    io.emit('message-status-update', eventPayload);
                    io.emit('message-updated', eventPayload);
                }
            }
            }
        }
            }
        }

        // Always respond 200 OK to Meta
        res.sendStatus(200);

    } catch (error) {
        console.error('❌ [OfficialWebk] Error inside webhook:', error);
        res.sendStatus(500);
    }
});

module.exports = { router, setSocketIO };
