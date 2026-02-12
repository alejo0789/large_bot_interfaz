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

            const attempts = [
                {
                    name: 'Flat Minimal',
                    body: {
                        number: isJID ? phone : cleanNumber,
                        mediatype: mediaType,
                        media: mediaUrl,
                        caption: caption || '',
                        fileName: fileName,
                        checkContact: false
                    }
                },
                {
                    name: 'Nested mediaMessage',
                    body: {
                        number: isJID ? phone : cleanNumber,
                        mediaMessage: {
                            mediatype: mediaType,
                            caption: caption || '',
                            media: mediaUrl,
                            fileName: fileName
                        },
                        checkContact: false
                    }
                },
                {
                    name: 'JID Suffix',
                    body: {
                        number: isJID ? phone : `${cleanNumber}@s.whatsapp.net`,
                        mediatype: mediaType,
                        media: mediaUrl,
                        caption: caption || '',
                        fileName: fileName,
                        checkContact: false
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
     * Fetch Base64 for a media message
     * @param {Object} messageFull - The full message object from the webhook
     */
    async fetchBase64(messageFull) {
        try {
            const url = `${this.baseUrl}/chat/getBase64FromMediaMessage/${this.instance}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': this.apiKey },
                body: JSON.stringify({
                    message: messageFull,
                    convertToMp4: false
                })
            });

            const data = await response.json();
            if (data && data.base64) {
                return data.base64;
            }
            return null;
        } catch (error) {
            console.error('❌ Error fetching base64:', error.message);
            return null;
        }
    }
}

module.exports = new EvolutionService();
