/**
 * Evolution API Integration Service
 * Handles communication with WhatsApp via Evolution API v2
 */
const { config } = require('../config/app');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

class EvolutionService {
    constructor() {
        this.baseUrl = config.evolutionApiUrl;
        this.apiKey = config.evolutionApiKey;
        this.instance = config.evolutionInstance;
    }

    /**
     * Send a text message
     * @param {string} phone - Phone number (573...) or JID (123@g.us)
     * @param {string} message - Text message
     */
    async sendText(phone, message) {
        try {
            const cleanNumber = phone.replace(/\D/g, '');
            const isJID = phone.includes('-') || phone.includes('@');
            const url = `${this.baseUrl}/message/sendText/${this.instance}`;

            // WE WILL TRY SEVERAL STRUCTURES AND DOMAINS UNTIL ONE SUCCEEDS
            const attempts = [
                {
                    name: 'Options Wrapped (LID Fix)',
                    body: {
                        number: isJID ? phone : cleanNumber,
                        text: message,
                        options: {
                            delay: 500,
                            presence: "composing",
                            linkPreview: false,
                            checkContact: false,   // Try inside options
                            force: true            // Try inside options
                        },
                        checkContact: false        // Keep at root just in case
                    }
                },
                {
                    name: 'Hybrid (Text + Nested)',
                    body: {
                        number: isJID ? phone : cleanNumber,
                        text: message,
                        textMessage: { text: message },
                        checkContact: false,
                        options: { checkContact: false }
                    }
                },
                {
                    name: 'Flat Minimal',
                    body: { number: isJID ? phone : cleanNumber, text: message, checkContact: false }
                },
                {
                    name: 'JID @c.us (LID Fallback)',
                    body: { number: isJID ? phone.replace('@lid', '@c.us') : `${cleanNumber}@c.us`, text: message, checkContact: false }
                }
            ];

            let lastError = null;

            for (const attempt of attempts) {
                console.log(`📡 Trying strategy [${attempt.name}] for [${attempt.body.number}]...`);

                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': this.apiKey },
                        body: JSON.stringify(attempt.body)
                    });

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
    async sendMessage(phone, message) {
        return this.sendText(phone, message);
    }

    /**
     * Send media message (image, video, doc)
     */
    async sendMedia(phone, mediaUrl, mediaType, caption, fileName) {
        try {
            const cleanNumber = phone.replace(/\D/g, '');
            const isJID = phone.includes('-') || phone.includes('@');
            const url = `${this.baseUrl}/message/sendMedia/${this.instance}`;

            // --- LOCALHOST FIX ---
            let finalMediaUrl = mediaUrl;
            if (finalMediaUrl.includes('localhost') && config.publicUrl && !config.publicUrl.includes('localhost')) {
                console.log(`🔄 Replacing localhost in media URL [${mediaUrl}] with public URL: [${config.publicUrl}]`);
                finalMediaUrl = finalMediaUrl.replace(/http:\/\/localhost:\d+/, config.publicUrl);
            }

            // Infer extension if missing from fileName
            let finalFileName = fileName || 'file';
            if (!finalFileName.includes('.')) {
                if (mediaType === 'image') finalFileName += '.jpg';
                else if (mediaType === 'video') finalFileName += '.mp4';
                else if (mediaType === 'audio') finalFileName += '.mp3';
                else if (mediaType === 'document') finalFileName += '.pdf';
            }

            const attempts = [
                {
                    name: 'standard (media + mediatype)',
                    body: {
                        number: isJID ? phone : cleanNumber,
                        mediatype: mediaType,
                        media: finalMediaUrl,
                        caption: caption || '',
                        fileName: finalFileName
                    }
                },
                {
                    name: 'alternative (url + mediatype)',
                    body: {
                        number: isJID ? phone : cleanNumber,
                        mediatype: mediaType,
                        url: finalMediaUrl,
                        caption: caption || '',
                        fileName: finalFileName
                    }
                },
                {
                    name: 'legacy (media + type)',
                    body: {
                        number: isJID ? phone : cleanNumber,
                        type: mediaType,
                        media: finalMediaUrl,
                        caption: caption || '',
                        fileName: finalFileName
                    }
                }
            ];

            let lastError = null;

            for (const attempt of attempts) {
                console.log(`📡 Trying sendMedia strategy [${attempt.name}] to ${attempt.body.number}...`);

                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': this.apiKey },
                        body: JSON.stringify(attempt.body)
                    });

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
            const url = `${this.baseUrl}/instance/connectionState/${this.instance}`;
            const response = await fetch(url, {
                headers: { 'apikey': this.apiKey }
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
            // Probaremos varios endpoints comunes en Evolution API v2/v1
            const endpoints = [
                `/group/findGroup/${this.instance}?groupJid=${groupJid}`,
                `/group/info/${this.instance}?groupJid=${groupJid}`,
                `/group/findGroup?instance=${this.instance}&groupJid=${groupJid}`
            ];

            for (const endpoint of endpoints) {
                const url = `${this.baseUrl}${endpoint}`;
                console.log(`📡 Trying Group Info Endpoint: ${url}`);

                try {
                    const response = await fetch(url, {
                        headers: { 'apikey': this.apiKey }
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
            const cleanNumber = phone.replace(/\D/g, '');
            const isJID = phone.includes('-') || phone.includes('@');
            const jid = isJID ? phone : `${cleanNumber}@c.us`;

            const url = `${this.baseUrl}/chat/markMessageAsRead/${this.instance}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': this.apiKey },
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
            const cleanNumber = phone.replace(/\D/g, '');
            const isJID = phone.includes('-') || phone.includes('@');
            const jid = isJID ? phone : `${cleanNumber}@c.us`;

            // En Evolution API v2, marcar como NO leído suele ser el mismo endpoint con read: false
            // o un endpoint específico dependiendo de la versión. 
            // Intentaremos markMessageAsRead con read: false
            const url = `${this.baseUrl}/chat/markMessageAsRead/${this.instance}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': this.apiKey },
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
            const url = `${this.baseUrl}/chat/getBase64FromMessage/${this.instance}`;

            // Evolution v2 expects the message object that contains 'key' and 'message'
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.apiKey
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
}

module.exports = new EvolutionService();
