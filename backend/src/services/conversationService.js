/**
 * Conversation Service
 * Business logic for conversations
 */
const { pool } = require('../config/database');

class ConversationService {
    /**
     * Get all conversations
     */
    async getAll() {
        const { rows } = await pool.query(`
            SELECT 
                phone,
                contact_name,
                last_message_text,
                last_message_timestamp,
                unread_count,
                status,
                ai_enabled,
                conversation_state,
                created_at,
                updated_at
            FROM conversations 
            ORDER BY last_message_timestamp DESC NULLS LAST, created_at DESC
        `);

        return rows.map(conv => ({
            id: conv.phone,
            contact: {
                name: conv.contact_name,
                phone: conv.phone
            },
            lastMessage: conv.last_message_text || 'No hay mensajes',
            timestamp: conv.last_message_timestamp
                ? new Date(conv.last_message_timestamp).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit'
                })
                : new Date(conv.created_at).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
            unread: conv.unread_count || 0,
            status: conv.status || 'active',
            aiEnabled: conv.ai_enabled !== false,
            state: conv.conversation_state || 'ai_active'
        }));
    }

    /**
     * Get conversation by phone
     */
    async getByPhone(phone) {
        const { rows } = await pool.query(
            'SELECT * FROM conversations WHERE phone = $1',
            [phone]
        );
        return rows[0] || null;
    }

    /**
     * Create or update conversation
     */
    async upsert(phone, contactName, aiEnabled = true) {
        const { rows } = await pool.query(`
            INSERT INTO conversations (phone, contact_name, ai_enabled, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (phone) DO UPDATE SET
                contact_name = COALESCE(EXCLUDED.contact_name, conversations.contact_name),
                updated_at = NOW()
            RETURNING *
        `, [phone, contactName, aiEnabled]);
        return rows[0];
    }

    /**
     * Mark conversation as read
     */
    async markAsRead(phone) {
        await pool.query(`
            UPDATE conversations 
            SET unread_count = 0, updated_at = NOW() 
            WHERE phone = $1
        `, [phone]);
    }

    /**
     * Update last message
     */
    async updateLastMessage(phone, message) {
        await pool.query(`
            UPDATE conversations 
            SET 
                last_message_text = $1,
                last_message_timestamp = NOW(),
                updated_at = NOW()
            WHERE phone = $2
        `, [message, phone]);
    }

    /**
     * Increment unread count
     */
    async incrementUnread(phone) {
        await pool.query(`
            UPDATE conversations 
            SET unread_count = COALESCE(unread_count, 0) + 1, updated_at = NOW() 
            WHERE phone = $1
        `, [phone]);
    }

    /**
     * Toggle AI for conversation
     */
    async toggleAI(phone, enabled) {
        const state = enabled ? 'ai_active' : 'agent_active';
        await pool.query(`
            UPDATE conversations 
            SET 
                ai_enabled = $1,
                conversation_state = $2,
                updated_at = NOW()
            WHERE phone = $3
        `, [enabled, state, phone]);
        return { aiEnabled: enabled, state };
    }

    /**
     * Take conversation by agent
     */
    async takeByAgent(phone, agentId) {
        await pool.query(`
            UPDATE conversations 
            SET 
                conversation_state = 'agent_active',
                agent_id = $1,
                taken_by_agent_at = NOW(),
                ai_enabled = false,
                updated_at = NOW()
            WHERE phone = $2
        `, [agentId || 'manual_agent', phone]);
    }

    /**
     * Reactivate AI
     */
    async reactivateAI(phone) {
        await pool.query(`
            UPDATE conversations 
            SET 
                conversation_state = 'ai_active',
                agent_id = NULL,
                taken_by_agent_at = NULL,
                ai_enabled = true,
                updated_at = NOW()
            WHERE phone = $1
        `, [phone]);
    }

    /**
     * Close/Archive conversation
     */
    async close(phone) {
        await pool.query(`
            UPDATE conversations 
            SET status = 'archived', updated_at = NOW() 
            WHERE phone = $1
        `, [phone]);
    }
}

module.exports = new ConversationService();
