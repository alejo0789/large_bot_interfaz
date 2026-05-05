/**
 * N8N Integration Service
 * Handles communication with N8N webhooks
 */
const { config } = require('../config/app');
const { tenantContext } = require('../utils/tenantContext');

class N8NService {
    /**
     * Resolves the current N8N config based on the tenant context
     */
    getConfig() {
        const context = tenantContext.getStore();
        const tenant = context?.tenant;

        return {
            webhookUrl: tenant?.n8n_webhook_url, // No fallback to ensure isolation between sedes
            slug: tenant?.slug || 'default'
        };
    }

    /**
     * Send message to N8N for WhatsApp delivery
     */
    async sendMessage({ phone, name, message, mediaType, mediaUrl, fileName, tempId }) {
        const { webhookUrl, slug } = this.getConfig();

        if (!webhookUrl) {
            console.warn('⚠️ N8N webhook not configured, message not sent to WhatsApp');
            return { sent: false, reason: 'N8N not configured' };
        }

        try {
            const fetch = (await import('node-fetch')).default;

            const payload = {
                sede: slug, // Include tenant slug
                phone,
                name,
                message,
                temp_id: tempId,
                conversation_state: 'agent_active',
                timestamp: new Date().toISOString()
            };

            if (mediaType) {
                payload.media_type = mediaType;
                payload.media_url = mediaUrl;
                payload.file_name = fileName;
            }

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`N8N responded with ${response.status}`);
            }

            console.log(`✅ Message sent to N8N [Sede: ${slug}]`);
            return { sent: true };
        } catch (error) {
            console.error('❌ Error sending to N8N:', error.message);
            return { sent: false, error: error.message };
        }
    }

    /**
     * Notify N8N of state change
     */
    async notifyStateChange(phone, state) {
        const { webhookUrl, slug } = this.getConfig();
        if (!webhookUrl) return;

        try {
            const fetch = (await import('node-fetch')).default;

            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sede: slug,
                    phone,
                    type: 'state_change',
                    new_state: state,
                    timestamp: new Date().toISOString()
                })
            });

            console.log(`✅ State change notified to N8N: ${phone} -> ${state} [Sede: ${slug}]`);
        } catch (error) {
            console.error('❌ Error notifying N8N:', error.message);
        }
    }

    /**
     * Trigger AI Processing in N8N
     * Call this when a new user message arrives and AI is enabled
     */
    async triggerAIProcessing({ phone, text, contactName, mediaType, mediaUrl }) {
        const { webhookUrl, slug } = this.getConfig();
        if (!webhookUrl) return null;

        try {
            const fetch = (await import('node-fetch')).default;

            const payload = {
                sede: slug,
                type: 'incoming_message',
                phone,
                name: contactName,
                message: text,
                timestamp: new Date().toISOString(),
                // Add media fields if present
                media_type: mediaType || null,
                media_url: mediaUrl || null
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.warn(`⚠️ N8N AI Trigger failed: ${response.status} [Sede: ${slug}]`);
                return null;
            }

            const data = await response.json();
            console.log(`📥 Raw N8N AI Response [Sede: ${slug}]:`, JSON.stringify(data));

            // n8n returns an array of items
            if (Array.isArray(data) && data.length > 0) {
                const item = data[0];
                return {
                    text: item.output || item.message || item.text || null,
                    mediaUrl: item.media_url || item.mediaUrl || item.image || null,
                    mediaType: item.media_type || item.mediaType || 'image',
                    intent_tag: item.intent_tag || item.intentTag || null, // Added to support lead classification
                    raw: item
                };
            }

            // Fallback for single object
            if (data && (data.output || data.message || data.text)) {
                return {
                    text: data.output || data.message || data.text || null,
                    mediaUrl: data.media_url || data.mediaUrl || data.image || null,
                    mediaType: data.media_type || data.mediaType || 'image',
                    intent_tag: data.intent_tag || data.intentTag || null, // Added to support lead classification
                    raw: data
                };
            }

            return null;

        } catch (error) {
            console.error('❌ Error in triggerAIProcessing:', error.message);
            return null;
        }
    }
}

module.exports = new N8NService();
