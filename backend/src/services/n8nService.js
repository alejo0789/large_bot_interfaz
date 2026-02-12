/**
 * N8N Integration Service
 * Handles communication with N8N webhooks
 */
const { config } = require('../config/app');

class N8NService {
    /**
     * Send message to N8N for WhatsApp delivery
     */
    async sendMessage({ phone, name, message, mediaType, mediaUrl, fileName, tempId }) {
        if (!config.n8nWebhookUrl) {
            console.warn('⚠️ N8N webhook not configured, message not sent to WhatsApp');
            return { sent: false, reason: 'N8N not configured' };
        }

        try {
            const fetch = (await import('node-fetch')).default;

            const payload = {
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

            const response = await fetch(config.n8nWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`N8N responded with ${response.status}`);
            }

            console.log('✅ Message sent to N8N');
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
        if (!config.n8nWebhookUrl) return;

        try {
            const fetch = (await import('node-fetch')).default;

            await fetch(config.n8nWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone,
                    type: 'state_change',
                    new_state: state,
                    timestamp: new Date().toISOString()
                })
            });

            console.log(`✅ State change notified to N8N: ${phone} -> ${state}`);
        } catch (error) {
            console.error('❌ Error notifying N8N:', error.message);
        }
    }

    /**
     * Trigger AI Processing in N8N
     * Call this when a new user message arrives and AI is enabled
     */
    async triggerAIProcessing({ phone, text, contactName, mediaType, mediaUrl }) {
        if (!config.n8nWebhookUrl) return null;

        try {
            const fetch = (await import('node-fetch')).default;

            const payload = {
                type: 'incoming_message',
                phone,
                name: contactName,
                message: text,
                timestamp: new Date().toISOString(),
                // Add media fields if present
                media_type: mediaType || null,
                media_url: mediaUrl || null
            };

            const response = await fetch(config.n8nWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.warn(`⚠️ N8N AI Trigger failed: ${response.status}`);
                return null;
            }

            const data = await response.json();

            // Expected format: [{ "output": "Respuesta..." }]
            if (Array.isArray(data) && data.length > 0 && data[0].output) {
                return data[0].output;
            }

            // Fallback for object format: { "output": "Respuesta..." }
            if (data && data.output) {
                return data.output;
            }

            return null;

        } catch (error) {
            console.error('❌ Error in triggerAIProcessing:', error.message);
            return null;
        }
    }
}

module.exports = new N8NService();
