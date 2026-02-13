/**
 * Conversation Service
 * Business logic for conversations
 * OPTIMIZED FOR 2000+ CONVERSATIONS with pagination
 */
const { pool } = require('../config/database');
const settingsService = require('./settingsService');

// Default pagination settings
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

class ConversationService {
    /**
     * Get conversations with pagination
     * @param {Object} options - Pagination options
     * @param {number} options.page - Page number (1-indexed)
     * @param {number} options.limit - Items per page
     * @param {string} options.status - Filter by status (active/archived)
     * @param {string} options.search - Search by contact name or phone
     */
    async getAll(options = {}) {
        const {
            page = 1,
            limit = DEFAULT_PAGE_SIZE,
            status = null,
            search = null
        } = options;

        // Sanitize pagination
        const safeLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
        const offset = (Math.max(1, page) - 1) * safeLimit;

        // Build dynamic WHERE clause
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (status) {
            conditions.push(`status = $${paramIndex++}`);
            params.push(status);
        }

        if (search) {
            conditions.push(`(contact_name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        // Count total (for pagination metadata)
        const countQuery = `SELECT COUNT(*) FROM conversations ${whereClause}`;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Get paginated data
        const dataQuery = `
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
            ${whereClause}
            ORDER BY last_message_timestamp DESC NULLS LAST, created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        params.push(safeLimit, offset);

        const { rows } = await pool.query(dataQuery, params);

        const conversations = rows.map(conv => ({
            id: conv.phone,
            contact: {
                name: conv.contact_name,
                phone: conv.phone
            },
            lastMessage: conv.last_message_text || 'No hay mensajes',
            timestamp: conv.last_message_timestamp
                ? new Date(conv.last_message_timestamp).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Bogota'
                })
                : new Date(conv.created_at).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Bogota'
                }),
            rawTimestamp: conv.last_message_timestamp || conv.created_at,
            unread: conv.unread_count || 0,
            status: conv.status || 'active',
            aiEnabled: conv.ai_enabled !== false,
            state: conv.conversation_state || 'ai_active'
        }));

        return {
            data: conversations,
            pagination: {
                page,
                limit: safeLimit,
                total,
                totalPages: Math.ceil(total / safeLimit),
                hasNext: offset + rows.length < total,
                hasPrev: page > 1
            }
        };
    }

    /**
     * Get all conversations (legacy support - paginated internally)
     * @deprecated Use getAll with pagination options instead
     */
    async getAllLegacy() {
        const result = await this.getAll({ limit: 200 });
        return result.data;
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
    async upsert(phone, contactName) {
        // Fetch default AI setting
        const defaultAiEnabledStr = await settingsService.get('default_ai_enabled', 'true');
        const defaultAiEnabled = String(defaultAiEnabledStr) === 'true';

        // Check if exists to preserve existing setting if it does
        const existing = await this.getByPhone(phone);

        if (existing) {
            // Only update contact name
            const { rows } = await pool.query(`
                UPDATE conversations 
                SET 
                    contact_name = COALESCE($1, contact_name),
                    updated_at = NOW()
                WHERE phone = $2
                RETURNING *
            `, [contactName, phone]);
            return rows[0];
        } else {
            // Insert new with default setting
            const { rows } = await pool.query(`
                INSERT INTO conversations (phone, contact_name, ai_enabled, conversation_state, created_at, updated_at)
                VALUES ($1, $2, $3, $4, NOW(), NOW())
                ON CONFLICT (phone) DO UPDATE SET updated_at = NOW()
                RETURNING *
            `, [phone, contactName, defaultAiEnabled, defaultAiEnabled ? 'ai_active' : 'agent_active']);
            return rows[0];
        }
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
     * Set AI status for ALL conversations
     */
    async setAllAI(enabled) {
        const state = enabled ? 'ai_active' : 'agent_active';
        await pool.query(`
            UPDATE conversations 
            SET 
                ai_enabled = $1,
                conversation_state = $2,
                updated_at = NOW()
        `, [enabled, state]);
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

    /**
     * Get statistics for dashboard
     */
    async getStats() {
        const { rows } = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'active') as active_count,
                COUNT(*) FILTER (WHERE status = 'archived') as archived_count,
                COUNT(*) FILTER (WHERE ai_enabled = true) as ai_enabled_count,
                COUNT(*) FILTER (WHERE ai_enabled = false) as manual_count,
                SUM(unread_count) as total_unread
            FROM conversations
        `);
        return rows[0];
    }
}

module.exports = new ConversationService();

