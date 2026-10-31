const axios = require('axios');
const { tenantContext } = require('../utils/tenantContext');
const tiktokOAuthService = require('./tiktokOAuthService');

class TikTokService {
    constructor() {
        this.baseUrl = 'https://business-api.tiktok.com/open_api/v1.3';
    }

    /**
     * Enviar mensaje de texto a una conversación de TikTok
     * @param {string} conversationId - ID de la conversación de TikTok
     * @param {string} text - Contenido del mensaje
     */
    async sendMessage(conversationId, text) {
        const tenant = tenantContext.getStore()?.tenant;
        if (!tenant?.id) {
            return { success: false, error: 'TikTok message send requires a tenant context' };
        }

        let connection;
        try {
            connection = await tiktokOAuthService.getAccessToken(tenant.id);
        } catch (error) {
            console.error('TikTok access token unavailable:', error.message);
            return { success: false, error: 'TikTok authorization is unavailable or expired' };
        }
        if (!connection?.accessToken || !connection?.openId) {
            return { success: false, error: 'TikTok is not connected for this workspace' };
        }

        const cleanConvId = conversationId.replace(/^tiktok_/, '');

        console.log(`📤 [TikTok] Enviando mensaje a conv ${cleanConvId}...`);

        const payload = {
            business_id: String(connection.openId),
            recipient_type: 'CONVERSATION',
            recipient: {
                conversation_id: String(cleanConvId)
            },
            message_type: 'TEXT',
            text: {
                text: String(text)
            }
        };

        try {
            const response = await axios.post(`${this.baseUrl}/business/message/send/`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Token': connection.accessToken
                }
            });

            console.log('📥 [TikTok] Respuesta de envío:', JSON.stringify(response.data));

            if (response.data.code === 0) {
                return {
                    success: true,
                    messageId: response.data.data?.message?.message_id || `tt_${Date.now()}`,
                    data: response.data.data
                };
            } else {
                return {
                    success: false,
                    error: response.data.message,
                    code: response.data.code
                };
            }
        } catch (error) {
            console.error('❌ [TikTok] Error al enviar mensaje:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
}

module.exports = new TikTokService();
