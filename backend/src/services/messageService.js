/**
 * Message Service
 * Business logic for messages
 */
const { pool } = require('../config/database');

class MessageService {
    /**
     * Get messages by conversation phone
     */
    async getByConversation(phone) {
        const { rows } = await pool.query(`
            SELECT 
                id,
                whatsapp_id,
                conversation_phone,
                sender,
                text_content,
                media_type,
                media_url,
                status,
                timestamp
            FROM messages 
            WHERE conversation_phone = $1 
            ORDER BY timestamp ASC
        `, [phone]);

        return rows.map(msg => ({
            id: msg.whatsapp_id || msg.id,
            text: msg.text_content,
            sender: msg.sender,
            timestamp: new Date(msg.timestamp).toLocaleTimeString('es-CO', {
                hour: '2-digit',
                minute: '2-digit'
            }),
            status: msg.status || 'delivered',
            media_type: msg.media_type || null,
            media_url: msg.media_url || null
        }));
    }

    /**
     * Create a new message
     */
    async create({ phone, sender, text, whatsappId, mediaType, mediaUrl, status = 'delivered' }) {
        const { rows } = await pool.query(`
            INSERT INTO messages (
                conversation_phone, 
                sender, 
                text_content, 
                whatsapp_id,
                media_type,
                media_url,
                status, 
                timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING id
        `, [phone, sender, text, whatsappId, mediaType, mediaUrl, status]);

        return rows[0];
    }

    /**
     * Update message status
     */
    async updateStatus(whatsappId, status) {
        await pool.query(`
            UPDATE messages 
            SET status = $1 
            WHERE whatsapp_id = $2
        `, [status, whatsappId]);
    }

    /**
     * Check if message exists by WhatsApp ID
     */
    async existsByWhatsappId(whatsappId) {
        const { rows } = await pool.query(
            'SELECT 1 FROM messages WHERE whatsapp_id = $1',
            [whatsappId]
        );
        return rows.length > 0;
    }
}

module.exports = new MessageService();
