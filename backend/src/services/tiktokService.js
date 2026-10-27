const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(__dirname, '../../tiktok_token.json');

class TikTokService {
    constructor() {
        this.baseUrl = 'https://business-api.tiktok.com/open_api/v1.3';
    }

    /**
     * Obtiene el access_token y business_id guardados
     */
    getTokenData() {
        if (fs.existsSync(TOKEN_FILE)) {
            try {
                return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
            } catch (e) {
                console.error('Error leyendo tiktok_token.json:', e);
            }
        }
        return {
            access_token: process.env.TIKTOK_ACCESS_TOKEN || '986fcdabe72bc5529f54c417fe202d90904abb2a',
            advertiser_ids: ['7690267379779272756']
        };
    }

    /**
     * Enviar mensaje de texto a una conversación de TikTok
     * @param {string} conversationId - ID de la conversación de TikTok
     * @param {string} text - Contenido del mensaje
     * @param {string} [customToken] - Token opcional si se maneja por sede
     */
    async sendMessage(conversationId, text, customToken = null) {
        const tokenData = this.getTokenData();
        const accessToken = customToken || tokenData.access_token;
        const businessId = tokenData.advertiser_ids?.[0] || '7690267379779272756';

        if (!accessToken) {
            throw new Error('TikTok Access Token no configurado');
        }

        const cleanConvId = conversationId.replace(/^tiktok_/, '');

        console.log(`📤 [TikTok] Enviando mensaje a conv ${cleanConvId}...`);

        const payload = {
            business_id: String(businessId),
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
                    'Access-Token': accessToken
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
