/**
 * Evolution API Integration Service
 * Handles communication with WhatsApp via Evolution API v2
 */
const { config } = require('../config/app');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { tenantContext } = require('../utils/tenantContext');

class EvolutionService {
    constructor() {
        this.baseUrl = config.evolutionApiUrl;
        this.globalApiKey = config.evolutionApiKey;
        this.globalInstance = config.evolutionInstance;
    }

    /**
     * Resolves the current Evolution config (instance and key) 
     * based on the tenant context
     */
    getConfig() {
        const context = tenantContext.getStore();
        const tenant = context?.tenant;

        return {
            instance: tenant?.evolution_instance || this.globalInstance,
            apiKey: tenant?.evolution_api_key || this.globalApiKey // Added support for per-tenant keys
        };
    }

    /**
     * Send a text message
     * @param {string} phone - Phone number (573...) or JID (123@g.us)
     * @param {string} message - Text message
     * @param {string} [replyMessageId] - ID of the message to reply to
     */
    async sendText(phone, message, replyMessageId = null) {
        try {
            const { instance, apiKey } = this.getConfig();
            const cleanNumber = phone.replace(/\D/g, '');
            const isJID = phone.includes('-') || phone.includes('@');
            const url = `${this.baseUrl}/message/sendText/${instance}`;

            const options = {
                delay: 500,
                presence: "composing",
                linkPreview: false,
                checkContact: false,
                force: true
            };

            if (replyMessageId) {
                const jid = isJID ? phone : `${cleanNumber}@s.whatsapp.net`;
                options.quoted = {
                    key: {
                        remoteJid: jid,
                        id: replyMessageId
                    },
                    message: {
                        conversation: "..." // Placeholder text
                    }
                };
            }

            // WE WILL TRY SEVERAL STRUCTURES AND DOMAINS UNTIL ONE SUCCEEDS
            const attempts = [
                {
                    name: 'JID Quoted Root',
                    body: {
                        number: isJID ? phone : `${cleanNumber}@s.whatsapp.net`,
                        text: message,
                        quoted: options.quoted,
                        ...options
                    }
                },
                {
                    name: 'Standard Quoted Root',
                    body: {
                        number: isJID ? phone : cleanNumber,
                        text: message,
                        quoted: options.quoted,
                        ...options
                    }
                },
                {
                    name: 'Options Wrapped',
                    body: {
                        number: isJID ? phone : cleanNumber,
                        text: message,
                        options: options,
                        quoted: options.quoted,
                        checkContact: false
                    }
                }
            ];

            let lastError = null;

            for (const attempt of attempts) {
                console.log(`📡 Trying strategy [${attempt.name}] for [${attempt.body.number}]...`);

                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                        body: JSON.stringify(attempt.body),
                        signal: controller.signal
                    });
                    clearTimeout(timeout);

                    const data = await response.json();

                    if (response.ok) {
                        console.log(`✅ SUCCESS [STRATEGY: ${attempt.name}] to ${attempt.body.number}`);
                        return { success: true, data };
                    }

                    console.warn(`⚠️ Strategy [${attempt.name}] failed:`,
                        typeof data.response === 'object' ? JSON.stringify(data.response) : (data.message || JSON.stringify(data)));

                    lastError = data;
                } catch (err) {
                    console.error(`❌ Strategy [${attempt.name}] FATAL:`, err.message);
                }
            }

            console.error('❌ FAILED: All sendText strategies exhausted.');
            return { success: false, error: lastError };

        } catch (error) {
            console.error('❌sendText Critical Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Alias for compatibility
    async sendMessage(phone, message, replyMessageId = null) {
        return this.sendText(phone, message, replyMessageId);
    }

    /**
     * Send media message (image, video, doc)
     */
    async sendMedia(phone, mediaUrl, mediaType, caption, fileName) {
        try {
            const { instance, apiKey } = this.getConfig();
            console.log(`📡 [${instance}] sendMedia called with:`, { phone, mediaUrl, mediaType, caption, fileName });

            // Force valid mediaType locally just in case
            let validMediaType = (mediaType || '').trim().toLowerCase();
            const allowed = ['image', 'video', 'audio', 'document'];
            if (!allowed.includes(validMediaType)) {
                console.warn(`⚠️ Invalid mediaType passed to service: '${mediaType}'. Defaulting to 'document'.`);
                validMediaType = 'document';
            }

            const cleanNumber = phone.replace(/\D/g, '');
            const isJID = phone.includes('-') || phone.includes('@');
            
            // Si es audio, usamos sendWhatsAppAudio para que se envíe como nota de voz
            const endpoint = validMediaType === 'audio' ? 'sendWhatsAppAudio' : 'sendMedia';
            const url = `${this.baseUrl}/message/${endpoint}/${instance}`;

            // Extract replyMessageId from arguments if provided
            const replyMessageId = arguments.length > 5 ? arguments[5] : null;
            console.log(`💬 Reply ID for media: ${replyMessageId}`);

            // --- LOCALHOST FIX ---
            let finalMediaUrl = mediaUrl;
            if (finalMediaUrl.includes('localhost') && config.publicUrl && !config.publicUrl.includes('localhost')) {
                console.log(`🔄 Replacing localhost in media URL [${mediaUrl}] with public URL: [${config.publicUrl}]`);
                finalMediaUrl = finalMediaUrl.replace(/http:\/\/localhost:\d+/, config.publicUrl);
            }

            // Infer extension if missing from fileName
            let finalFileName = fileName || 'file';
            if (!finalFileName.includes('.')) {
                if (validMediaType === 'image') finalFileName += '.jpg';
                else if (validMediaType === 'video') finalFileName += '.mp4';
                else if (validMediaType === 'audio') finalFileName += '.mp3';
                else if (validMediaType === 'document') finalFileName += '.pdf';
            }

            const options = {
                delay: 500,
                presence: "composing",
                linkPreview: false,
                checkContact: false,
                force: true
            };

            if (replyMessageId) {
                const jid = isJID ? phone : `${cleanNumber}@s.whatsapp.net`;
                options.quoted = {
                    key: {
                        remoteJid: jid,
                        id: replyMessageId
                    },
                    message: {
                        conversation: "..."
                    }
                };
            }

            let attempts = [];

            if (validMediaType === 'audio') {
                // Para sendWhatsAppAudio el payload principal usa 'audio' en vez de 'media'
                attempts = [
                    {
                        name: 'whatsappAudio (JID)',
                        body: {
                            number: isJID ? phone : `${cleanNumber}@s.whatsapp.net`,
                            audio: finalMediaUrl,
                            quoted: options.quoted,
                            ...options
                        }
                    },
                    {
                        name: 'whatsappAudio (Clean Number)',
                        body: {
                            number: isJID ? phone : cleanNumber,
                            audio: finalMediaUrl,
                            quoted: options.quoted,
                            ...options
                        }
                    }
                ];
            } else {
                attempts = [
                    {
                        name: 'standard (media + mediatype)',
                        body: {
                            number: isJID ? phone : `${cleanNumber}@s.whatsapp.net`,
                            mediatype: validMediaType,
                            media: finalMediaUrl,
                            caption: caption || '',
                            fileName: finalFileName,
                            quoted: options.quoted,
                            ...options
                        }
                    },
                    {
                        name: 'standard (clean number)',
                        body: {
                            number: isJID ? phone : cleanNumber,
                            mediatype: validMediaType,
                            media: finalMediaUrl,
                            caption: caption || '',
                            fileName: finalFileName,
                            quoted: options.quoted,
                            ...options
                        }
                    }
                ];
            }

            let lastError = null;

            for (const attempt of attempts) {
                console.log(`🚀 Attempting Strategy [${attempt.name}]`);
                console.log(`   Body:`, JSON.stringify(attempt.body));
                console.log(`📡 Trying sendMedia strategy [${attempt.name}] to ${attempt.body.number}...`);

                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for media

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                        body: JSON.stringify(attempt.body),
                        signal: controller.signal
                    });
                    clearTimeout(timeout);

                    const data = await response.json();

                    if (response.ok) {
                        console.log(`✅ Success sendMedia [${attempt.name}] to ${attempt.body.number}`);
                        return { success: true, data };
                    }

                    console.warn(`⚠️ Strategy [${attempt.name}] failed:`,
                        typeof data.response === 'object' ? JSON.stringify(data.response) : (data.message || JSON.stringify(data)));

                    lastError = data;
                } catch (err) {
                    console.error(`❌ Strategy [${attempt.name}] FATAL:`, err.message);
                }
            }

            console.error('❌ FAILED: All sendMedia strategies exhausted.');
            return { success: false, error: lastError };

        } catch (error) {
            console.error('❌ sendMedia Critical Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check instance state
     */
    async checkInstance() {
        try {
            const { instance, apiKey } = this.getConfig();
            const url = `${this.baseUrl}/instance/connectionState/${instance}`;
            const response = await fetch(url, {
                headers: { 'apikey': apiKey }
            });
            return await response.json();
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Fetch group metadata
     * @param {string} groupJid - Group ID (e.g. 12345@g.us)
     */
    async fetchGroupInfo(groupJid) {
        try {
            const { instance, apiKey } = this.getConfig();
            // Probaremos varios endpoints comunes en Evolution API v2/v1
            const endpoints = [
                `/group/findGroup/${instance}?groupJid=${groupJid}`,
                `/group/info/${instance}?groupJid=${groupJid}`,
                `/group/findGroup?instance=${instance}&groupJid=${groupJid}`
            ];

            for (const endpoint of endpoints) {
                const url = `${this.baseUrl}${endpoint}`;
                console.log(`📡 [${instance}] Trying Group Info Endpoint: ${url}`);

                try {
                    const response = await fetch(url, {
                        headers: { 'apikey': apiKey }
                    });

                    const data = await response.json();

                    if (response.ok && (data.subject || data.id)) {
                        console.log(`✅ Success with endpoint ${endpoint}: ${data.subject}`);
                        return data;
                    }
                } catch (innerError) {
                    console.warn(`❌ Error with endpoint ${endpoint}:`, innerError.message);
                }
            }

            return null;
        } catch (error) {
            console.error('❌ Error fetching group info:', error);
            return null;
        }
    }

    /**
     * Mark a chat as read in WhatsApp
     */
    async markAsRead(phone) {
        try {
            const { instance, apiKey } = this.getConfig();
            const cleanNumber = phone.replace(/\D/g, '');
            const isJID = phone.includes('-') || phone.includes('@');
            const jid = isJID ? phone : `${cleanNumber}@c.us`;

            const url = `${this.baseUrl}/chat/markMessageAsRead/${instance}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({
                    number: jid,
                    read: true
                })
            });

            return await response.json();
        } catch (error) {
            console.error('❌ Error in markAsRead:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Mark a chat as unread in WhatsApp
     */
    async markAsUnread(phone) {
        try {
            const { instance, apiKey } = this.getConfig();
            const cleanNumber = phone.replace(/\D/g, '');
            const isJID = phone.includes('-') || phone.includes('@');
            const jid = isJID ? phone : `${cleanNumber}@c.us`;

            // En Evolution API v2, marcar como NO leído suele ser el mismo endpoint con read: false
            // o un endpoint específico dependiendo de la versión. 
            // Intentaremos markMessageAsRead con read: false
            const url = `${this.baseUrl}/chat/markMessageAsRead/${instance}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({
                    number: jid,
                    read: false
                })
            });

            return await response.json();
        } catch (error) {
            console.error('❌ Error in markAsUnread:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Fetch media as base64 from a message object
     * @param {Object} msg - The message object from webhook (data)
     */
    async fetchBase64(msg) {
        try {
            const { instance, apiKey } = this.getConfig();
            const url = `${this.baseUrl}/chat/getBase64FromMediaMessage/${instance}`;

            // Evolution v2 expects the message object that contains 'key' and 'message'
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': apiKey
                },
                body: JSON.stringify({
                    message: {
                        key: msg.key,
                        message: msg.message
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Evolution fetchBase64 failed:', errorData);
                return null;
            }

            const data = await response.json();
            // Evolution usually returns { base64: "..." }
            return data.base64 || null;

        } catch (error) {
            console.error('❌ Error in fetchBase64:', error.message);
            return null;
        }
    }
    /**
     * Check if a number is registered on WhatsApp
     * Using /chat/whatsappNumbers/{instance} endpoint
     */
    async checkNumber(phone) {
        try {
            const { instance, apiKey } = this.getConfig();
            // Clean number (only digits)
            const cleanNumber = phone.replace(/\D/g, '');
            const url = `${this.baseUrl}/chat/whatsappNumbers/${instance}`;

            console.log(`🔍 [${instance}] Checking WhatsApp number in Evolution: ${url} -> ${cleanNumber}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'apikey': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "numbers": [cleanNumber]
                })
            });

            if (!response.ok) {
                console.warn(`⚠️ API Error checking number: ${response.status}`);
                return false;
            }

            const data = await response.json();
            // Expected: [{ "exists": true, "jid": "57315...@s.whatsapp.net" }]

            if (Array.isArray(data) && data.length > 0) {
                return data[0]; // Return full object {exists, jid}
            }

            return false;

        } catch (error) {
            console.error('❌ Error checking WhatsApp number:', error);
            return false;
        }
    }

    /**
     * Send a reaction to a message
     * @param {string} phone - The remote JID (phone number of the contact)
     * @param {string} messageId - The ID of the message to react to
     * @param {string} reaction - The emoji reaction (or empty string to remove)
     * @param {boolean} fromMe - Whether the target message was sent by me (default: false)
     */
    async sendReaction(phone, messageId, reaction, fromMe = false) {
        try {
            const { instance, apiKey } = this.getConfig();
            const cleanNumber = phone.replace(/\D/g, '');
            const isJID = phone.includes('-') || phone.includes('@');
            const jid = isJID ? phone : `${cleanNumber}@s.whatsapp.net`;

            const url = `${this.baseUrl}/message/sendReaction/${instance}`;
            const body = {
                reaction: reaction,
                key: {
                    remoteJid: jid,
                    fromMe: fromMe,
                    id: messageId
                }
            };

            console.log(`📡 [Evolution:${instance}] Sending reaction to ${url}`);
            console.log(`   Payload:`, JSON.stringify(body));

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': apiKey
                },
                body: JSON.stringify(body)
            });

            const responseText = await response.text();
            console.log(`   Response Status: ${response.status}`);
            console.log(`   Response Body:`, responseText);

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                data = { error: 'Invalid JSON response', raw: responseText };
            }

            if (response.ok) {
                return { success: true, data };
            }

            console.warn(`⚠️ [Evolution] Reaction failed:`, data);
            return { success: false, error: data };

        } catch (error) {
            console.error('❌ [Evolution] Error sending reaction:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update (edit) a sent message
     * @param {string} phone - The remote phone number or JID
     * @param {string} messageId - The ID of the message to update
     * @param {string} newText - The new text content
     * @param {boolean} fromMe - Was the message sent by me (usually true for edits)
     */
    async updateMessage(phone, messageId, newText, fromMe = true) {
        try {
            const { instance, apiKey } = this.getConfig();
            const cleanNumber = phone.replace(/\D/g, '');
            const isJID = phone.includes('-') || phone.includes('@');
            const jid = isJID ? phone : `${cleanNumber}@s.whatsapp.net`;

            const url = `${this.baseUrl}/chat/updateMessage/${instance}`;
            const body = {
                number: jid,
                key: {
                    remoteJid: jid,
                    fromMe: fromMe,
                    id: messageId
                },
                text: newText
            };

            console.log(`📡 [Evolution:${instance}] Updating message via POST ${url}`);
            console.log(`   Payload:`, JSON.stringify(body));

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': apiKey
                },
                body: JSON.stringify(body)
            });

            console.log(`   Response Status: ${response.status}`);

            const responseText = await response.text();

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                data = { error: 'Invalid JSON response', raw: responseText };
            }

            if (response.ok) {
                return { success: true, data };
            }

            console.warn(`⚠️ [Evolution] Update message failed:`, data);
            return { success: false, error: data };

        } catch (error) {
            console.error('❌ [Evolution] Error updating message:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a message for everyone
     * @param {string} phone - The remote JID
     * @param {string} messageId - The WhatsApp message ID
     * @param {boolean} fromMe - Whether the message was sent by me
     */
    async deleteMessage(phone, messageId, fromMe) {
        try {
            const { instance, apiKey } = this.getConfig();
            const cleanNumber = phone.replace(/\D/g, '');
            const isJID = phone.includes('-') || phone.includes('@');
            const jid = isJID ? phone : `${cleanNumber}@s.whatsapp.net`;

            // Try multiple strategies for deletion as endpoints vary by version
            const strategies = [
                // Strategy 1: Standard v2 DELETE /message/...
                {
                    url: `${this.baseUrl}/message/deleteMessageForEveryone/${instance}`,
                    method: 'DELETE',
                    body: { remoteJid: jid, id: messageId, fromMe: fromMe }
                },
                // Strategy 2: Fallback v2 POST /message/...
                {
                    url: `${this.baseUrl}/message/deleteMessageForEveryone/${instance}`,
                    method: 'POST',
                    body: { remoteJid: jid, id: messageId, fromMe: fromMe }
                },
                // Strategy 3: Legacy DELETE /chat/...
                {
                    url: `${this.baseUrl}/chat/deleteMessageForEveryone/${instance}`,
                    method: 'DELETE',
                    body: { remoteJid: jid, id: messageId, fromMe: fromMe }
                }
            ];

            let lastResult = null;

            for (const strategy of strategies) {
                console.log(`🗑️ [Evolution:${instance}] Deleting message via ${strategy.url} [${strategy.method}]`);

                try {
                    const response = await fetch(strategy.url, {
                        method: strategy.method,
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': apiKey
                        },
                        body: JSON.stringify(strategy.body)
                    });

                    const responseText = await response.text();
                    console.log(`   Response Status: ${response.status}`);
                    console.log(`   Body:`, responseText);

                    if (response.ok) {
                        return { success: true, data: JSON.parse(responseText) };
                    }

                    lastResult = { status: response.status, body: responseText };

                } catch (e) {
                    console.error(`   Strategy failed:`, e.message);
                }
            }

            console.warn(`⚠️ [Evolution] Delete message failed on all strategies`);
            return { success: false, error: lastResult };

        } catch (error) {
            console.error('❌ [Evolution] Error deleting message:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Delete (clear) an entire chat in WhatsApp
     * Uses /chat/deleteChat/{instance} — removes the conversation from WhatsApp
     * @param {string} phone - Phone number or JID
     */
    async deleteChat(phone) {
        try {
            const { instance, apiKey } = this.getConfig();
            const cleanNumber = phone.replace(/\D/g, '');
            const isJID = phone.includes('-') || phone.includes('@');
            const jid = isJID ? phone : `${cleanNumber}@s.whatsapp.net`;

            // Try multiple endpoint variants (Evolution v1/v2 differ)
            const attempts = [
                { url: `${this.baseUrl}/chat/deleteChat/${instance}`, method: 'DELETE', body: { jid } },
                { url: `${this.baseUrl}/chat/deleteChat/${instance}`, method: 'POST', body: { jid } },
                { url: `${this.baseUrl}/chat/delete/${instance}`, method: 'DELETE', body: { jid } },
                { url: `${this.baseUrl}/chat/deleteChat/${instance}`, method: 'DELETE', body: { number: jid } },
            ];

            for (const attempt of attempts) {
                console.log(`🗑️ [Evolution:${instance}] deleteChat via ${attempt.method} ${attempt.url}`);
                try {
                    const res = await fetch(attempt.url, {
                        method: attempt.method,
                        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                        body: JSON.stringify(attempt.body)
                    });
                    const text = await res.text();
                    console.log(`   Status: ${res.status} — ${text.substring(0, 120)}`);
                    if (res.ok) {
                        console.log(`✅ [Evolution] deleteChat success for ${jid}`);
                        return { success: true };
                    }
                } catch (e) {
                    console.warn(`   Attempt failed: ${e.message}`);
                }
            }

            // Not a hard failure — log but don't block DB deletion
            console.warn(`⚠️ [Evolution] Could not delete chat in WhatsApp for ${jid} — will still delete from DB`);
            return { success: false, warning: 'Could not delete from WhatsApp, deleted from DB only' };
        } catch (error) {
            console.error('❌ [Evolution] deleteChat error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Fetch profile picture URL from WhatsApp
     * @param {string} phone - Phone number
     * @returns {string|null} - URL of the profile picture or null
     */
    async getProfilePicture(phone) {
        try {
            const { instance, apiKey } = this.getConfig();
            const cleanNumber = phone.replace(/\D/g, '');
            const isJID = phone.includes('-') || phone.includes('@');
            const numberParam = isJID ? phone : cleanNumber;

            // Strategy 1: GET (Common in Evolution API v1/v2 endpoints)
            const getUrl = `${this.baseUrl}/chat/fetchProfilePictureUrl/${instance}?number=${numberParam}`;

            const getResponse = await fetch(getUrl, {
                method: 'GET',
                headers: {
                    'apikey': apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (getResponse.ok) {
                const data = await getResponse.json();
                if (data && (data.picture || data.profilePictureUrl)) {
                    return data.picture || data.profilePictureUrl;
                }
            }

            // Strategy 2: POST Fallback (Common in some Evolution API v2 endpoints)
            const postUrl = `${this.baseUrl}/chat/fetchProfilePictureUrl/${instance}`;
            const postResponse = await fetch(postUrl, {
                method: 'POST',
                headers: {
                    'apikey': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ number: numberParam })
            });

            if (postResponse.ok) {
                const data = await postResponse.json();
                if (data && (data.picture || data.profilePictureUrl)) {
                    return data.picture || data.profilePictureUrl;
                }
            }

            return null;
        } catch (error) {
            console.error(`❌ Error fetching profile picture for ${phone}:`, error.message);
            return null;
        }
    }

    /**
     * Create a new instance in Evolution API
     * @param {string} instanceName 
     */
    async createInstance(instanceName) {
        try {
            const url = `${this.baseUrl}/instance/create`;
            // Simplified body, Evolution v2 often fails if token is "" but expected format
            const body = {
                instanceName: instanceName,
                integration: "WHATSAPP-BAILEYS",
                qrcode: true
            };

            console.log(`📡 Creating Evolution instance: ${instanceName} at ${url}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.globalApiKey
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('❌ Evolution API Error:', JSON.stringify(data, null, 2));
                // Extract message from various possible Evolution v2 response formats
                const errorMsg = data.message ||
                    (data.response && data.response.message) ||
                    (Array.isArray(data.error) ? data.error[0] : data.error) ||
                    'Error creating Evolution instance';

                throw new Error(errorMsg);
            }

            return { success: true, instance: data.instance };
        } catch (error) {
            console.error('❌ createInstance Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get QR code for an instance
     * @param {string} instanceName 
     */
    async getQR(instanceName) {
        try {
            const url = `${this.baseUrl}/instance/connect/${instanceName}`;
            const response = await fetch(url, {
                headers: { 'apikey': this.globalApiKey }
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Error fetching QR code');
            }

            return { success: true, qr: data }; // Should contain base64 or code
        } catch (error) {
            console.error('❌ getQR Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Configure webhook for an instance (MESSAGES_UPSERT, MESSAGES_UPDATE, CONNECTION_UPDATE)
     * @param {string} instanceName
     * @param {string} webhookUrl - Full URL where Evolution will POST events
     */
    async setWebhook(instanceName, webhookUrl) {
        try {
            // Evolution v2 uses PUT /webhook/set/{instance}
            const url = `${this.baseUrl}/webhook/set/${instanceName}`;
            const body = {
                webhook: {
                    enabled: true,
                    url: webhookUrl,
                    webhookByEvents: false,
                    webhookBase64: true,   // send media as base64 so we can save them
                    events: [
                        'MESSAGES_UPSERT',
                        'MESSAGES_UPDATE',
                        'MESSAGES_DELETE',
                        'CONNECTION_UPDATE',
                        'SEND_MESSAGE'
                    ]
                }
            };

            console.log(`🔗 Setting webhook for [${instanceName}] → ${webhookUrl}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.globalApiKey
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (!response.ok) {
                // Try alternative structure (some Evolution forks differ)
                console.warn(`⚠️ setWebhook attempt 1 failed (${response.status}), trying alternative structure...`);

                const altUrl = `${this.baseUrl}/webhook/set/${instanceName}`;
                const altBody = {
                    enabled: true,
                    url: webhookUrl,
                    webhookByEvents: false,
                    webhookBase64: true,
                    events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE']
                };

                const altResponse = await fetch(altUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'apikey': this.globalApiKey },
                    body: JSON.stringify(altBody)
                });

                const altData = await altResponse.json();
                if (!altResponse.ok) {
                    throw new Error(altData.message || `HTTP ${altResponse.status}`);
                }
                console.log(`✅ Webhook set (alt method) for ${instanceName}`);
                return { success: true, data: altData };
            }

            console.log(`✅ Webhook set successfully for ${instanceName}`);
            return { success: true, data };
        } catch (error) {
            console.error('❌ setWebhook Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Fetch all chats from an Evolution instance (for initial sync)
     * @param {string} instanceName
     * @returns {{ success: boolean, chats: Array }}
     */
    async fetchChats(instanceName) {
        try {
            // Evolution v2: POST /chat/findChats/{instance}
            const url = `${this.baseUrl}/chat/findChats/${instanceName}`;
            console.log(`📋 Fetching chats from Evolution [${instanceName}]: ${url}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.globalApiKey
                },
                body: JSON.stringify({})
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }

            // data can be an array of chats directly or { chats: [] }
            const chats = Array.isArray(data) ? data : (data.chats || data.data || []);
            console.log(`✅ Fetched ${chats.length} chats from Evolution [${instanceName}]`);
            return { success: true, chats };
        } catch (error) {
            console.error('❌ fetchChats Error:', error);
            return { success: false, chats: [], error: error.message };
        }
    }

    /**
     * Fetch recent messages for a chat from Evolution
     * @param {string} instanceName
     * @param {string} remoteJid - e.g. "57312...@s.whatsapp.net"
     * @param {number} count - number of messages to fetch (default 30)
     */
    async fetchRecentMessages(instanceName, remoteJid, count = 30) {
        try {
            const url = `${this.baseUrl}/chat/findMessages/${instanceName}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': this.globalApiKey },
                body: JSON.stringify({
                    where: { key: { remoteJid } },
                    limit: count
                })
            });

            if (!response.ok) return { success: false, messages: [] };

            const data = await response.json();
            const messages = Array.isArray(data) ? data : (data.messages?.records || data.records || data.data || []);
            return { success: true, messages };
        } catch (error) {
            console.error(`❌ fetchRecentMessages Error for ${remoteJid}:`, error);
            return { success: false, messages: [] };
        }
    }
}

module.exports = new EvolutionService();
