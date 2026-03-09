/**
 * WhatsApp Service Factory
 * Returns the appropriate service (Evolution API or Official WhatsApp API)
 * depending on the tenant's configuration
 */
const evolutionService = require('./evolutionService');
const whatsappOfficialService = require('./whatsappOfficialService');
const { tenantContext } = require('../utils/tenantContext');

class WhatsappFactory {
    /**
     * Get the configured service for the current tenant
     */
    getService() {
        const context = tenantContext.getStore();
        const tenant = context?.tenant;

        if (tenant && tenant.whatsapp_provider === 'official') {
            return whatsappOfficialService;
        }

        // Default to evolution service
        return evolutionService;
    }

    /**
     * Pass-through methods that auto-route to the correct service
     */

    async sendText(phone, message, replyMessageId = null) {
        return this.getService().sendText(phone, message, replyMessageId);
    }

    async sendMessage(phone, message, replyMessageId = null) {
        return this.getService().sendMessage(phone, message, replyMessageId);
    }

    async sendMedia(phone, mediaUrl, mediaType, caption, fileName) {
        return this.getService().sendMedia(phone, mediaUrl, mediaType, caption, fileName);
    }

    async markAsRead(phone) {
        return this.getService().markAsRead(phone);
    }

    async markAsUnread(phone) {
        return this.getService().markAsUnread(phone);
    }

    async checkInstance() {
        return this.getService().checkInstance();
    }

    async fetchGroupInfo(groupJid) {
        return this.getService().fetchGroupInfo(groupJid);
    }

    async fetchBase64(msg) {
        return this.getService().fetchBase64(msg);
    }

    async checkNumber(phone) {
        return this.getService().checkNumber(phone);
    }

    async sendReaction(phone, messageId, reaction, fromMe = false) {
        return this.getService().sendReaction(phone, messageId, reaction, fromMe);
    }

    async updateMessage(phone, messageId, newText, fromMe = true) {
        return this.getService().updateMessage(phone, messageId, newText, fromMe);
    }

    async deleteMessage(phone, messageId, fromMe) {
        return this.getService().deleteMessage(phone, messageId, fromMe);
    }

    async deleteChat(phone) {
        return this.getService().deleteChat(phone);
    }

    async getProfilePicture(phone) {
        return this.getService().getProfilePicture(phone);
    }
}

module.exports = new WhatsappFactory();
