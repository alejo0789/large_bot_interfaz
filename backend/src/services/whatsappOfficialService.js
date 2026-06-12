/**
 * Official WhatsApp API Integration Service
 * Handles communication with WhatsApp via Meta Graph API (Cloud API)
 * 
 * Supported methods (parity with evolutionService):
 *   sendText, sendMessage, sendMedia, sendReaction,
 *   markAsRead, markAsUnread, checkInstance, checkNumber,
 *   downloadMedia, getProfilePicture
 *   (fetchGroupInfo, fetchBase64, deleteChat, updateMessage, deleteMessage — not available in Cloud API)
 */
const { config } = require('../config/app');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { tenantContext } = require('../utils/tenantContext');
const fs = require('fs');
const path = require('path');

const GRAPH_API_VERSION = 'v19.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

class WhatsappOfficialService {
    constructor() {
        this.baseUrl = GRAPH_BASE;
    }

    // ─────────────────────────────────────────────
    // INTERNAL HELPERS
    // ─────────────────────────────────────────────

    /**
     * Resolves the current WhatsApp Official config based on the tenant context
     */
    getConfig() {
        const context = tenantContext.getStore();
        const tenant = context?.tenant;

        if (!tenant) {
            console.warn('⚠️ [OfficialAPI] No tenant context found');
        }

        return {
            phoneNumberId: tenant?.wa_phone_number_id,
            accessToken: tenant?.wa_access_token,
            tenantSlug: tenant?.slug
        };
    }

    /**
     * Shared fetch wrapper with auth header
     */
    async _post(url, body, accessToken) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        return { ok: response.ok, status: response.status, data };
    }

    /**
     * Clean phone to digits only
     */
    _cleanPhone(phone) {
        return phone.replace(/\D/g, '');
    }

    // ─────────────────────────────────────────────
    // SEND METHODS
    // ─────────────────────────────────────────────

    /**
     * Send a text message
     * @param {string} phone - Recipient phone number (digits only, e.g. 573001234567)
     * @param {string} message - Text content
     * @param {string} [replyMessageId] - WhatsApp message ID to quote/reply to
     */
    async sendText(phone, message, replyMessageId = null) {
        try {
            const { phoneNumberId, accessToken } = this.getConfig();
            if (!phoneNumberId || !accessToken) {
                return { success: false, error: 'Missing Official WhatsApp credentials for this tenant' };
            }

            const cleanNumber = this._cleanPhone(phone);
            const url = `${this.baseUrl}/${phoneNumberId}/messages`;

            const body = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanNumber,
                type: 'text',
                text: {
                    preview_url: false,
                    body: message
                }
            };

            // Quote/reply support
            if (replyMessageId) {
                body.context = { message_id: replyMessageId };
            }

            console.log(`📡 [OfficialAPI] sendText → ${cleanNumber} | len=${message.length}`);

            const { ok, data } = await this._post(url, body, accessToken);

            if (ok) {
                console.log(`✅ [OfficialAPI] Text sent to ${cleanNumber} | wamid=${data?.messages?.[0]?.id}`);
                return { success: true, data };
            }

            console.error(`❌ [OfficialAPI] sendText failed:`, JSON.stringify(data));
            return { success: false, error: data };

        } catch (error) {
            console.error('❌ [OfficialAPI] sendText critical error:', error);
            return { success: false, error: error.message };
        }
    }

    /** Alias for compatibility with evolutionService interface */
    async sendMessage(phone, message, replyMessageId = null) {
        return this.sendText(phone, message, replyMessageId);
    }

    /**
     * Send a media message (image, video, audio, document)
     * @param {string} phone
     * @param {string} mediaUrl - Publicly accessible URL of the media file
     * @param {string} mediaType - 'image' | 'video' | 'audio' | 'document'
     * @param {string} [caption]
     * @param {string} [fileName] - Only used for documents
     */
    async sendMedia(phone, mediaUrl, mediaType, caption, fileName) {
        try {
            const { phoneNumberId, accessToken } = this.getConfig();
            if (!phoneNumberId || !accessToken) {
                return { success: false, error: 'Missing Official WhatsApp credentials for this tenant' };
            }

            const allowed = ['image', 'video', 'audio', 'document'];
            const validMediaType = allowed.includes((mediaType || '').toLowerCase())
                ? mediaType.toLowerCase()
                : 'document';

            const cleanNumber = this._cleanPhone(phone);
            const url = `${this.baseUrl}/${phoneNumberId}/messages`;

            const mediaObj = { link: mediaUrl };
            if (caption && ['image', 'video', 'document'].includes(validMediaType)) {
                mediaObj.caption = caption;
            }
            if (fileName && validMediaType === 'document') {
                mediaObj.filename = fileName;
            }

            const body = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanNumber,
                type: validMediaType,
                [validMediaType]: mediaObj
            };

            console.log(`📡 [OfficialAPI] sendMedia → ${cleanNumber} | type=${validMediaType}`);

            const { ok, data } = await this._post(url, body, accessToken);

            if (ok) {
                console.log(`✅ [OfficialAPI] Media sent to ${cleanNumber}`);
                return { success: true, data };
            }

            console.error(`❌ [OfficialAPI] sendMedia failed:`, JSON.stringify(data));
            return { success: false, error: data };

        } catch (error) {
            console.error('❌ [OfficialAPI] sendMedia critical error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send a reaction emoji to a specific message
     * Meta Cloud API supports reactions via type: "reaction"
     * @param {string} phone - Recipient phone
     * @param {string} messageId - The WhatsApp message ID (wamid) to react to
     * @param {string} reaction - Emoji character, or empty string "" to remove
     * @param {boolean} [fromMe] - Ignored in Official API (not needed)
     */
    async sendReaction(phone, messageId, reaction, fromMe = false) {
        try {
            const { phoneNumberId, accessToken } = this.getConfig();
            if (!phoneNumberId || !accessToken) {
                return { success: false, error: 'Missing Official WhatsApp credentials for this tenant' };
            }

            const cleanNumber = this._cleanPhone(phone);
            const url = `${this.baseUrl}/${phoneNumberId}/messages`;

            const body = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanNumber,
                type: 'reaction',
                reaction: {
                    message_id: messageId,
                    emoji: reaction || '' // Empty string removes the reaction
                }
            };

            console.log(`📡 [OfficialAPI] sendReaction → ${cleanNumber} | msgId=${messageId} | emoji="${reaction}"`);

            const { ok, data } = await this._post(url, body, accessToken);

            if (ok) {
                console.log(`✅ [OfficialAPI] Reaction sent to ${cleanNumber}`);
                return { success: true, data };
            }

            console.error(`❌ [OfficialAPI] sendReaction failed:`, JSON.stringify(data));
            return { success: false, error: data };

        } catch (error) {
            console.error('❌ [OfficialAPI] sendReaction critical error:', error);
            return { success: false, error: error.message };
        }
    }

    // ─────────────────────────────────────────────
    // READ / STATUS METHODS
    // ─────────────────────────────────────────────

    /**
     * Mark a specific incoming message as read
     * Meta Cloud API requires the wamid (message ID), not just the phone number.
     * Call this with the last incoming whatsapp_id from the conversation.
     * @param {string} phone - Phone number (used for logging only in this implementation)
     * @param {string} [messageId] - The WhatsApp message ID (wamid) to mark as read
     */
    async markAsRead(phone, messageId = null) {
        try {
            const { phoneNumberId, accessToken } = this.getConfig();
            if (!phoneNumberId || !accessToken) {
                return { success: false, error: 'Missing Official WhatsApp credentials' };
            }

            if (!messageId) {
                // Without a message ID, we can't mark as read in the Official API.
                // This is a known limitation — log and return gracefully.
                console.info(`ℹ️ [OfficialAPI] markAsRead: no messageId provided for ${phone} — skipping`);
                return { success: true, skipped: true, reason: 'No messageId provided' };
            }

            const url = `${this.baseUrl}/${phoneNumberId}/messages`;

            const body = {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId
            };

            console.log(`📡 [OfficialAPI] markAsRead → messageId=${messageId}`);

            const { ok, data } = await this._post(url, body, accessToken);

            if (ok) {
                console.log(`✅ [OfficialAPI] Message ${messageId} marked as read`);
                return { success: true, data };
            }

            console.warn(`⚠️ [OfficialAPI] markAsRead failed:`, JSON.stringify(data));
            return { success: false, error: data };

        } catch (error) {
            console.error('❌ [OfficialAPI] markAsRead error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Mark as unread — not supported by Meta Cloud API.
     * Returns a graceful no-op to avoid breaking existing flows.
     */
    async markAsUnread(phone) {
        console.info(`ℹ️ [OfficialAPI] markAsUnread not supported by Meta Cloud API — skipping for ${phone}`);
        return { success: true, skipped: true, reason: 'Not supported by Meta Cloud API' };
    }

    // ─────────────────────────────────────────────
    // MEDIA DOWNLOAD (INCOMING MESSAGES)
    // ─────────────────────────────────────────────

    /**
     * Download an incoming media file from Meta servers and save it locally.
     * Meta sends a media_id — we must exchange it for a URL, then download the binary.
     * 
     * @param {string} mediaId - The media ID received in the webhook payload
     * @param {string} tenantSlug - Used to determine upload directory
     * @param {string} mimeType - e.g. "image/jpeg", "audio/ogg; codecs=opus"
     * @returns {string|null} - Public URL of the saved file, or null on failure
     */
    async downloadMedia(mediaId, tenantSlug, mimeType = 'application/octet-stream') {
        try {
            const { accessToken } = this.getConfig();
            if (!accessToken) {
                console.warn('⚠️ [OfficialAPI] downloadMedia: no accessToken');
                return null;
            }

            // Step 1: Resolve media ID → temporary URL
            const metaInfoUrl = `${this.baseUrl}/${mediaId}`;
            const infoResponse = await fetch(metaInfoUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!infoResponse.ok) {
                const err = await infoResponse.text();
                console.error(`❌ [OfficialAPI] downloadMedia: Failed to get media info for ${mediaId}:`, err);
                return null;
            }

            const mediaInfo = await infoResponse.json();
            const temporaryUrl = mediaInfo?.url;

            if (!temporaryUrl) {
                console.error(`❌ [OfficialAPI] downloadMedia: No URL in response for ${mediaId}`, mediaInfo);
                return null;
            }

            // Step 2: Download the binary using the temporary URL + bearer token
            const fileResponse = await fetch(temporaryUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!fileResponse.ok) {
                console.error(`❌ [OfficialAPI] downloadMedia: Failed to download file from ${temporaryUrl}`);
                return null;
            }

            // Determine file extension from mime type
            const ext = this._getExtensionFromMime(mimeType);
            const filename = `wa_${mediaId}_${Date.now()}${ext}`;

            // Determine upload directory (mirrors the multi-tenant path logic)
            const uploadBase = config.uploadDir || path.join(process.cwd(), 'uploads');
            const uploadDir = tenantSlug
                ? path.join(uploadBase, tenantSlug)
                : uploadBase;

            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const filePath = path.join(uploadDir, filename);

            // Write file to disk
            const arrayBuffer = await fileResponse.arrayBuffer();
            fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

            // Build public URL
            const publicUrl = tenantSlug
                ? `${config.publicUrl}/uploads/${tenantSlug}/${filename}`
                : `${config.publicUrl}/uploads/${filename}`;

            console.log(`✅ [OfficialAPI] Media downloaded: ${filename} → ${publicUrl}`);
            return publicUrl;

        } catch (error) {
            console.error('❌ [OfficialAPI] downloadMedia critical error:', error);
            return null;
        }
    }

    /**
     * Map MIME type to file extension
     * @private
     */
    _getExtensionFromMime(mime) {
        const map = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'image/gif': '.gif',
            'video/mp4': '.mp4',
            'video/3gpp': '.3gp',
            'audio/ogg': '.ogg',
            'audio/ogg; codecs=opus': '.ogg',
            'audio/mpeg': '.mp3',
            'audio/mp4': '.m4a',
            'audio/aac': '.aac',
            'application/pdf': '.pdf',
            'application/vnd.ms-excel': '.xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
            'application/msword': '.doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        };

        // Normalize (remove codec suffixes for matching)
        const baseMime = (mime || '').split(';')[0].trim().toLowerCase();
        return map[baseMime] || map[mime.toLowerCase()] || '.bin';
    }

    // ─────────────────────────────────────────────
    // INSTANCE / STATUS
    // ─────────────────────────────────────────────

    /**
     * Check if the Official API credentials are valid by calling /me on Graph API
     */
    async checkInstance() {
        try {
            const { phoneNumberId, accessToken } = this.getConfig();
            if (!phoneNumberId || !accessToken) {
                return { state: 'DISCONNECTED', error: 'Missing credentials' };
            }

            const url = `${this.baseUrl}/${phoneNumberId}?fields=id,display_phone_number,verified_name`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            const data = await response.json();

            if (response.ok) {
                return {
                    state: 'CONNECTED',
                    phoneNumberId,
                    displayPhoneNumber: data.display_phone_number,
                    verifiedName: data.verified_name
                };
            }

            return { state: 'DISCONNECTED', error: data };

        } catch (error) {
            return { state: 'ERROR', error: error.message };
        }
    }

    /**
     * Check if a phone number is on WhatsApp.
     * Meta Cloud API does not provide a direct "check number" endpoint for Cloud API users.
     * Returns a best-effort response (always true) to avoid breaking existing flows.
     */
    async checkNumber(phone) {
        console.info(`ℹ️ [OfficialAPI] checkNumber: not available in Meta Cloud API — returning assumed true for ${phone}`);
        return { exists: true, jid: this._cleanPhone(phone) };
    }

    /**
     * Fetch profile picture URL.
     * Not available via Meta Cloud API (privacy restrictions).
     */
    async getProfilePicture(phone) {
        console.info(`ℹ️ [OfficialAPI] getProfilePicture: not available via Meta Cloud API`);
        return null;
    }

    // ─────────────────────────────────────────────
    // NOT AVAILABLE IN META CLOUD API
    // ─────────────────────────────────────────────

    /** Groups not supported via Cloud API */
    async fetchGroupInfo(groupJid) {
        console.info(`ℹ️ [OfficialAPI] fetchGroupInfo: groups not supported via Meta Cloud API`);
        return null;
    }

    /** Base64 media fetch not applicable (use downloadMedia instead) */
    async fetchBase64(msg) {
        console.info(`ℹ️ [OfficialAPI] fetchBase64: use downloadMedia() instead for Official API`);
        return null;
    }

    /** Edit sent message — not available in Meta Cloud API */
    async updateMessage(phone, messageId, newText, fromMe = true) {
        console.info(`ℹ️ [OfficialAPI] updateMessage: not supported by Meta Cloud API`);
        return { success: false, error: 'Editing messages is not supported by Meta Cloud API' };
    }

    /** Delete sent message — not available in Meta Cloud API */
    async deleteMessage(phone, messageId, fromMe) {
        console.info(`ℹ️ [OfficialAPI] deleteMessage: not supported by Meta Cloud API`);
        return { success: false, error: 'Deleting messages is not supported by Meta Cloud API' };
    }

    /** Delete chat — not available in Meta Cloud API */
    async deleteChat(phone) {
        console.info(`ℹ️ [OfficialAPI] deleteChat: not supported by Meta Cloud API`);
        return { success: false, error: 'Deleting chats is not supported by Meta Cloud API' };
    }
}

module.exports = new WhatsappOfficialService();
