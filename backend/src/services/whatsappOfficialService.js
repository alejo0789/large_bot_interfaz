/**
 * Official WhatsApp API Integration Service
 * Handles communication with WhatsApp via Meta Graph API
 */
const { config } = require('../config/app');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { tenantContext } = require('../utils/tenantContext');

class WhatsappOfficialService {
    constructor() {
        this.graphApiVersion = 'v19.0';
        this.baseUrl = `https://graph.facebook.com/${this.graphApiVersion}`;
    }

    /**
     * Resolves the current WhatsApp Official config
     * based on the tenant context
     */
    getConfig() {
        const context = tenantContext.getStore();
        const tenant = context?.tenant;

        if (!tenant) {
            console.warn('⚠️ whatsappOfficialService: No tenant context found');
        }

        return {
            phoneNumberId: tenant?.wa_phone_number_id,
            accessToken: tenant?.wa_access_token
        };
    }

    /**
     * Send a text message
     */
    async sendText(phone, message, replyMessageId = null) {
        try {
            const { phoneNumberId, accessToken } = this.getConfig();
            if (!phoneNumberId || !accessToken) {
                return { success: false, error: 'Missing Official WhatsApp credentials for this tenant' };
            }

            const cleanNumber = phone.replace(/\D/g, '');
            const url = `${this.baseUrl}/${phoneNumberId}/messages`;

            const body = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: cleanNumber,
                type: "text",
                text: {
                    preview_url: false,
                    body: message
                }
            };

            if (replyMessageId) {
                body.context = {
                    message_id: replyMessageId
                };
            }

            console.log(`📡 [OfficialAPI] Sending text to ${cleanNumber}...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.ok) {
                console.log(`✅ [OfficialAPI] Text sent successfully to ${cleanNumber}`);
                return { success: true, data };
            }

            console.error(`❌ [OfficialAPI] Failed to send text:`, data);
            return { success: false, error: data };

        } catch (error) {
            console.error('❌ [OfficialAPI] Critical Error in sendText:', error);
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
            const { phoneNumberId, accessToken } = this.getConfig();
            if (!phoneNumberId || !accessToken) {
                return { success: false, error: 'Missing Official WhatsApp credentials for this tenant' };
            }

            console.log(`📡 [OfficialAPI] sendMedia called with:`, { phone, mediaUrl, mediaType, caption, fileName });

            let validMediaType = (mediaType || '').trim().toLowerCase();
            const allowed = ['image', 'video', 'audio', 'document'];
            if (!allowed.includes(validMediaType)) {
                validMediaType = 'document';
            }

            const cleanNumber = phone.replace(/\D/g, '');
            const url = `${this.baseUrl}/${phoneNumberId}/messages`;

            const body = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: cleanNumber,
                type: validMediaType,
                [validMediaType]: {
                    link: mediaUrl
                }
            };

            if (caption && (validMediaType === 'image' || validMediaType === 'video' || validMediaType === 'document')) {
                body[validMediaType].caption = caption;
            }

            if (fileName && validMediaType === 'document') {
                body[validMediaType].filename = fileName;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.ok) {
                console.log(`✅ [OfficialAPI] Media sent successfully to ${cleanNumber}`);
                return { success: true, data };
            }

            console.error(`❌ [OfficialAPI] Failed to send media:`, data);
            return { success: false, error: data };

        } catch (error) {
            console.error('❌ [OfficialAPI] sendMedia Critical Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Mark a chat as read in WhatsApp
     */
    async markAsRead(phone) {
        try {
            // Meta Graph API typically marks messages as read by message ID, not by phone.
            // This is a mockup to avoid breaking since evolution uses it.
            // To properly implement, we need the actual message ID incoming from Meta.
            console.log(`ℹ️ [OfficialAPI] markAsRead not fully supported by phone number without message ID in Official API.`);
            return { success: true, info: 'Mock: marking as read is message-specific in Official API' };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Unimplemented or unsupported methods for Official API logic parity
     */
    async fetchGroupInfo(groupJid) { return null; }
    async markAsUnread(phone) { return { success: false, error: 'Not supported' }; }
    async fetchBase64(msg) { return null; }
    async checkNumber(phone) { return true; } // Might need specialized logic
    async sendReaction(phone, messageId, reaction, fromMe = false) { return { success: false, error: 'Not supported in this wrapper yet' }; }
    async updateMessage(phone, messageId, newText, fromMe = true) { return { success: false, error: 'Not supported' }; }
    async deleteMessage(phone, messageId, fromMe) { return { success: false, error: 'Not supported' }; }
    async deleteChat(phone) { return { success: false, error: 'Not supported' }; }
    async getProfilePicture(phone) { return null; }
}

module.exports = new WhatsappOfficialService();
