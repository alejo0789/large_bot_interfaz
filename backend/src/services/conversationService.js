/**
 * Conversation Service
 * Business logic for conversations
 * OPTIMIZED FOR 2000+ CONVERSATIONS with pagination
 */
const { pool } = require('../config/database');
const settingsService = require('./settingsService');
const { normalizePhone } = require('../utils/phoneUtils');


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
            search = null,
            tagId = null, // Added tagId filter
            startDate = null,
            endDate = null,
            unreadOnly = false,
            leadTime = null
        } = options;

        // Sanitize pagination
        const safeLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
        const offset = (Math.max(1, page) - 1) * safeLimit;

        // Build dynamic WHERE clause
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        let searchParamIndex = 0;
        let joinClause = '';

        if (status) {
            conditions.push(`c.status = $${paramIndex++}`);
            params.push(status);
        }

        if (search) {
            searchParamIndex = paramIndex;
            conditions.push(`(
                c.contact_name ILIKE $${paramIndex} 
                OR c.phone ILIKE $${paramIndex}
                OR EXISTS (
                    SELECT 1 FROM messages m 
                    WHERE m.conversation_phone = c.phone 
                    AND m.text_content ILIKE $${paramIndex}
                )
            )`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (tagId) {
            joinClause = 'JOIN conversation_tags ct_filter ON c.phone = ct_filter.conversation_phone';
            conditions.push(`ct_filter.tag_id = $${paramIndex++}`);
            params.push(tagId);
        }

        if (startDate) {
            conditions.push(`COALESCE(c.last_message_timestamp, c.created_at) >= $${paramIndex++}`);
            params.push(startDate);
        }

        if (endDate) {
            conditions.push(`COALESCE(c.last_message_timestamp, c.created_at) <= $${paramIndex++}`);
            params.push(endDate);
        }

        if (unreadOnly) {
            conditions.push(`c.unread_count > 0`);
        }
        
        if (leadTime) {
            conditions.push(`c.lead_time = $${paramIndex++}`);
            params.push(leadTime);
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        // Count total (for pagination metadata)
        const countQuery = `SELECT COUNT(*) FROM conversations c ${joinClause} ${whereClause}`;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Get paginated data
        const dataQuery = `
            SELECT 
                c.phone,
                c.contact_name,
                c.last_message_text,
                c.last_message_timestamp,
                c.unread_count,
                c.status,
                c.ai_enabled,
                c.conversation_state,
                c.created_at,
                c.updated_at,
                c.is_pinned,
                c.lead_intent,
                c.lead_time,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
                     FROM tags t
                     JOIN conversation_tags ct ON t.id = ct.tag_id
                     WHERE ct.conversation_phone = c.phone
                    ), '[]'
                ) as tags
            FROM conversations c
            ${joinClause}
            ${whereClause}
            ORDER BY 
                ${search ? `(c.contact_name ILIKE $${searchParamIndex} OR c.phone ILIKE $${searchParamIndex}) DESC,` : ''} 
                c.is_pinned DESC,
                c.last_message_timestamp DESC NULLS LAST, 
                c.created_at DESC
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
            state: conv.conversation_state || 'ai_active',
            tags: conv.tags || [],
            isPinned: conv.is_pinned || false,
            leadIntent: conv.lead_intent,
            leadTime: conv.lead_time
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
        const normalizedPhone = normalizePhone(phone);
        const { rows } = await pool.query(
            'SELECT * FROM conversations WHERE phone = $1',
            [normalizedPhone]
        );
        return rows[0] || null;
    }

    /**
     * Create or update conversation
     */
    async upsert(phone, contactName) {
        const normalizedPhone = normalizePhone(phone);
        // Fetch default AI setting
        const defaultAiEnabledStr = await settingsService.get('default_ai_enabled', 'false');
        const defaultAiEnabled = String(defaultAiEnabledStr) === 'true';

        // Check if exists to preserve existing setting if it does
        const existing = await this.getByPhone(phone);

        if (existing) {
            // Only update contact name if provided AND the current name is a placeholder or empty
            const { rows } = await pool.query(`
                UPDATE conversations 
                SET 
                    contact_name = CASE 
                        WHEN contact_name IS NULL OR contact_name = '' OR contact_name LIKE 'Usuario %' OR contact_name = phone THEN COALESCE($1, contact_name)
                        ELSE contact_name
                    END,
                    updated_at = NOW()
                WHERE phone = $2
                RETURNING *
            `, [contactName, normalizedPhone]);
            return rows[0];
        } else {
            // Use placeholder if no name provided for new conversation
            const finalName = contactName || `Usuario ${normalizedPhone.slice(-4)}`;

            // Insert new with default setting
            const { rows } = await pool.query(`
                INSERT INTO conversations (phone, contact_name, ai_enabled, conversation_state, created_at, updated_at)
                VALUES ($1, $2, $3, $4, NOW(), NOW())
                ON CONFLICT (phone) DO UPDATE SET updated_at = NOW()
                RETURNING *
            `, [normalizedPhone, finalName, defaultAiEnabled, defaultAiEnabled ? 'ai_active' : 'agent_active']);
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
     * Mark conversation as unread locally
     */
    async markAsUnread(phone) {
        // Marcamos con 1 mensaje no leído si queremos forzar el estado
        await pool.query(`
            UPDATE conversations 
            SET unread_count = GREATEST(unread_count, 1), updated_at = NOW() 
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

    /**
     * Get statistics for lead classification (Seguimiento)
     */
    async getLeadStats() {
        const { rows } = await pool.query(`
            SELECT 
                lead_time as classification,
                COUNT(*) as total
            FROM conversations
            WHERE status = 'active' AND lead_time IS NOT NULL
            GROUP BY lead_time
        `);
        return rows;
    }

    /**
     * Get recipients for bulk messaging based on filters
     * @param {Object} filters
     */
    async getRecipients(filters = {}) {
        const {
            tagId = null,
            startDate = null,
            endDate = null,
            leadTime = null,
            status = 'active'
        } = filters;

        // Build dynamic WHERE clause
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        let joinClause = '';

        if (status) {
            conditions.push(`c.status = $${paramIndex++}`);
            params.push(status);
        }

        if (tagId) {
            joinClause = ' JOIN conversation_tags ct_filter ON c.phone = ct_filter.conversation_phone';
            conditions.push(`ct_filter.tag_id = $${paramIndex++}`);
            params.push(tagId);
        }

        if (startDate) {
            conditions.push(` COALESCE(c.last_message_timestamp, c.created_at) >= $${paramIndex++}`);
            params.push(startDate);
        }

        if (endDate) {
            conditions.push(` COALESCE(c.last_message_timestamp, c.created_at) <= $${paramIndex++}`);
            params.push(endDate);
        }

        if (leadTime) {
            let leadTimes = [];
            if (Array.isArray(leadTime)) {
                leadTimes = leadTime;
            } else if (typeof leadTime === 'string') {
                leadTimes = leadTime.split(',');
            }
            
            if (leadTimes.length > 0) {
                const placeholders = leadTimes.map(() => `$${paramIndex++}`).join(', ');
                conditions.push(`c.lead_time IN (${placeholders})`);
                params.push(...leadTimes);
            }
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        const query = `
            SELECT 
                c.phone,
                c.contact_name
            FROM conversations c
            ${joinClause}
            ${whereClause}
        `;

        const { rows } = await pool.query(query, params);

        return rows.map(row => ({
            phone: row.phone,
            name: row.contact_name || 'Usuario'
        }));
    }

    /**
     * Force update contact name
     * Used when user manually edits the name from the UI
     */
    async updateContactName(phone, newName) {
        const { rows } = await pool.query(
            'UPDATE conversations SET contact_name = $1, updated_at = NOW() WHERE phone = $2 RETURNING *',
            [newName, phone]
        );
        return rows[0];
    }
    /**
     * Get or create a conversation
     */
    async getOrCreate(phone) {
        const normalizedPhone = normalizePhone(phone);
        // Try to get existing
        const { rows } = await pool.query('SELECT * FROM conversations WHERE phone = $1', [normalizedPhone]);

        if (rows.length > 0) {
            // Fetch tags for consistency
            const tagsQuery = `
                SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color)) as tags
                FROM tags t
                JOIN conversation_tags ct ON t.id = ct.tag_id
                WHERE ct.conversation_phone = $1
            `;
            const tagsRes = await pool.query(tagsQuery, [phone]);
            rows[0].tags = tagsRes.rows[0].tags || [];
            return rows[0];
        }

        // Fetch user default AI setting instead of hardcoding 'true'
        const defaultAiEnabledStr = await settingsService.get('default_ai_enabled', 'false');
        const defaultAiEnabled = String(defaultAiEnabledStr) === 'true';

        // Create new
        const insertQuery = `
            INSERT INTO conversations (phone, contact_name, status, created_at, updated_at, ai_enabled, unread_count, conversation_state)
            VALUES ($1, $1, 'active', NOW(), NOW(), $2, 0, $3)
            RETURNING *
        `;
        const result = await pool.query(insertQuery, [normalizedPhone, defaultAiEnabled, defaultAiEnabled ? 'ai_active' : 'agent_active']);
        const newConv = result.rows[0];
        newConv.tags = [];
        return newConv;
    }

    /**
     * Permanently delete a conversation and all its messages from the DB
     * @param {string} phone - Phone number (conversation identifier)
     * @returns {boolean} true if deleted, false if not found
     */
    async deleteConversation(phone) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Delete messages
            await client.query('DELETE FROM messages WHERE conversation_phone = $1', [phone]);

            // 2. Delete tag assignments
            await client.query('DELETE FROM conversation_tags WHERE conversation_phone = $1', [phone]);

            // 3. Delete the conversation itself
            const result = await client.query(
                'DELETE FROM conversations WHERE phone = $1 RETURNING phone',
                [phone]
            );

            await client.query('COMMIT');
            return result.rowCount > 0;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
    /**
     * Toggle conversation pin status
     */
    async togglePin(phone, isPinned) {
        const { rows } = await pool.query(`
            UPDATE conversations 
            SET is_pinned = $1, updated_at = NOW() 
            WHERE phone = $2
            RETURNING is_pinned
        `, [isPinned, phone]);

        return rows[0] || null;
    }

    /**
     * Bulk update AI status for all conversations
     */
    async setAllAI(isEnabled) {
        const state = isEnabled ? 'ai_active' : 'agent_active';
        const { rowCount } = await pool.query(`
            UPDATE conversations 
            SET ai_enabled = $1, conversation_state = $2, updated_at = NOW()
        `, [isEnabled, state]);
        return rowCount;
    }

    /**
     * Update lead intent
     */
    async updateLeadIntent(phone, intent) {
        await pool.query(
            'UPDATE conversations SET lead_intent = $1, updated_at = NOW() WHERE phone = $2',
            [intent, phone]
        );
    }

    /**
     * Update lead time tracking
     */
    async updateLeadTime(phone, timeTag) {
        await pool.query(
            'UPDATE conversations SET lead_time = $1, updated_at = NOW() WHERE phone = $2',
            [timeTag, phone]
        );
    }
    /**
     * Get count of conversations tagged "Agendar" today
     */
    async getDailyAgendasCount() {
        // Find the "Agendar" tag ID first
        const { rows: tagRows } = await pool.query("SELECT id FROM tags WHERE LOWER(name) = 'agendar'");
        if (tagRows.length === 0) return 0;
        
        const tagId = tagRows[0].id;
        
        // Count conversations that have this tag and were assigned today
        const { rows } = await pool.query(`
            SELECT COUNT(DISTINCT conversation_phone) as count
            FROM conversation_tags
            WHERE tag_id = $1
            AND assigned_at >= CURRENT_DATE
        `, [tagId]);
        
        return parseInt(rows[0].count) || 0;
    }
}

module.exports = new ConversationService();

