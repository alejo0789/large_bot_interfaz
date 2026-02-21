/**
 * Message Service
 * Business logic for messages
 * OPTIMIZED FOR HIGH VOLUME with pagination
 */
const { pool } = require('../config/database');

// Default pagination settings
const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 200;

class MessageService {
    /**
     * Get messages by conversation phone WITH PAGINATION
     * @param {string} phone - Conversation phone number
     * @param {Object} options - Pagination options
     * @param {number} options.limit - Messages per page
     * @param {string} options.before - Get messages before this timestamp (cursor)
     * @param {string} options.after - Get messages after this timestamp (cursor)
     */
    async getByConversation(phone, options = {}) {
        const {
            limit = DEFAULT_MESSAGE_LIMIT,
            before = null,
            after = null
        } = options;

        const safeLimit = Math.min(Math.max(1, limit), MAX_MESSAGE_LIMIT);
        const params = [phone];
        let paramIndex = 2;

        // Build query based on cursor direction
        let cursorCondition = '';
        let orderDirection = 'DESC';

        if (before) {
            cursorCondition = `AND timestamp < $${paramIndex++}`;
            params.push(before);
            orderDirection = 'DESC';
        } else if (after) {
            cursorCondition = `AND timestamp > $${paramIndex++}`;
            params.push(after);
            orderDirection = 'ASC';
        }

        params.push(safeLimit);

        const query = `
            SELECT 
                id,
                whatsapp_id,
                conversation_phone,
                sender,
                text_content,
                media_type,
                media_url,
                status,
                timestamp,
                agent_id,
                agent_name,
                sender_name,
                reactions
            FROM messages 
            WHERE conversation_phone = $1 ${cursorCondition}
            ORDER BY timestamp ${orderDirection}
            LIMIT $${paramIndex}
        `;

        let { rows } = await pool.query(query, params);

        // If we fetched with ASC (for 'after' cursor), reverse to maintain DESC order
        if (after) {
            rows = rows.reverse();
        }

        const messages = rows.map(msg => {
            // Parse timestamp - PostgreSQL returns Date object or string like "2025-12-14 23:28:07.035675+00"
            let msgTimestamp = null;

            if (msg.timestamp) {
                // If it's already a Date object from pg driver
                if (msg.timestamp instanceof Date) {
                    msgTimestamp = msg.timestamp;
                }
                // If it's a string, parse it
                else if (typeof msg.timestamp === 'string') {
                    // Replace space with T for ISO format compatibility
                    const isoString = msg.timestamp.replace(' ', 'T');
                    msgTimestamp = new Date(isoString);
                }
                // If it's a number (unix timestamp)
                else if (typeof msg.timestamp === 'number') {
                    msgTimestamp = new Date(msg.timestamp);
                }
            }

            const isValidDate = msgTimestamp && !isNaN(msgTimestamp.getTime());

            // Debug log for first message
            if (rows.indexOf(msg) === 0) {
                console.log(`📅 Timestamp debug - raw: ${msg.timestamp}, parsed: ${msgTimestamp?.toISOString()}, valid: ${isValidDate}`);
            }

            return {
                id: msg.whatsapp_id || msg.id,
                text: msg.text_content,
                sender: msg.sender,
                // Display time (HH:MM format)
                timestamp: isValidDate
                    ? msgTimestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })
                    : '',
                // Raw timestamp in ISO format for grouping
                rawTimestamp: isValidDate ? msgTimestamp.toISOString() : null,
                status: msg.status || 'delivered',
                media_type: msg.media_type || null,
                media_url: msg.media_url || null,
                agentId: msg.agent_id,
                agentName: msg.agent_name,
                sender_name: msg.sender_name,
                reactions: msg.reactions || []
            };
        });

        // Get cursors for next/prev pagination
        const hasMore = rows.length === safeLimit;
        const oldestTimestamp = rows.length > 0 ? rows[rows.length - 1].timestamp : null;
        const newestTimestamp = rows.length > 0 ? rows[0].timestamp : null;

        return {
            data: messages,
            pagination: {
                limit: safeLimit,
                hasMore,
                oldestCursor: oldestTimestamp?.toISOString(),
                newestCursor: newestTimestamp?.toISOString()
            }
        };
    }

    /**
     * Get messages (legacy format - for backward compatibility)
     * @deprecated Use getByConversation with pagination options
     */
    async getByConversationLegacy(phone) {
        const result = await this.getByConversation(phone, { limit: 100 });
        return result.data;
    }

    /**
     * Get initial messages for a conversation (most recent first)
     */
    async getInitialMessages(phone, limit = 50) {
        const result = await this.getByConversation(phone, { limit });
        // Reverse to show oldest first in chat view
        return {
            ...result,
            data: result.data.reverse()
        };
    }

    /**
     * Load older messages (for infinite scroll)
     */
    async loadOlderMessages(phone, beforeTimestamp, limit = 30) {
        return await this.getByConversation(phone, {
            limit,
            before: beforeTimestamp
        });
    }

    /**
     * Create a new message
     */
    async create({ phone, sender, text, whatsappId, mediaType, mediaUrl, status = 'delivered', agentId, agentName, senderName }) {
        // Verify if agent exists before inserting to avoid FK error
        let verifiedAgentId = null;
        if (agentId && !isNaN(agentId)) { // Only if it's a valid number
            try {
                const { rows: agentRows } = await pool.query('SELECT 1 FROM agents WHERE id = $1', [agentId]);
                if (agentRows.length > 0) {
                    verifiedAgentId = agentId;
                } else {
                    console.warn(`⚠️ Warning: Agent ID ${agentId} not found, saving message without agent reference`);
                }
            } catch (err) {
                console.warn(`⚠️ Warning: Could not verify agent ID ${agentId}:`, err.message);
            }
        } else if (agentId) {
            console.log(`🤖 Virtual agent string received ("${agentId}"), dropping reference to avoid integer error`);
            // verifiedAgentId stays null
        }

        const { rows } = await pool.query(`
            INSERT INTO messages (
                conversation_phone, 
                sender, 
                text_content, 
                whatsapp_id,
                media_type,
                media_url,
                status, 
                timestamp,
                agent_id,
                agent_name,
                sender_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10)
            RETURNING id, timestamp
        `, [phone, sender, text, whatsappId, mediaType, mediaUrl, status, verifiedAgentId, agentName, senderName]);

        return rows[0];
    }

    /**
     * Update message status
     */
    async updateStatus(messageId, status) {
        await pool.query(`
            UPDATE messages 
            SET status = $1 
            WHERE id = $2
        `, [status, messageId]);
    }

    /**
     * Update message WhatsApp ID and status
     */
    async updateWhatsappId(messageId, whatsappId, status = 'delivered') {
        await pool.query(`
            UPDATE messages 
            SET whatsapp_id = $1, status = $2
            WHERE id = $3
        `, [whatsappId, status, messageId]);
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

    /**
     * Get message count for a conversation
     */
    async getMessageCount(phone) {
        const { rows } = await pool.query(
            'SELECT COUNT(*) FROM messages WHERE conversation_phone = $1',
            [phone]
        );
        return parseInt(rows[0].count);
    }

    /**
     * Delete old messages (for archiving/cleanup)
     * @param {number} daysOld - Delete messages older than this many days
     */
    async deleteOldMessages(daysOld = 365) {
        const { rowCount } = await pool.query(`
            DELETE FROM messages 
            WHERE timestamp < NOW() - INTERVAL '${daysOld} days'
        `);
        return rowCount;
    }

    /**
     * Add or update a reaction to a message
     */
    async addReaction(messageId, reaction) {
        // Try to handle both UUID and String (whatsapp_id)
        // We will look up by whatsapp_id first as it is more likely what we have if we did mapped ID.
        // But if messageId is UUID, we check that too.

        // Strategy: First get current reactions
        const { rows } = await pool.query(`
            SELECT reactions, id 
            FROM messages 
            WHERE whatsapp_id = $1 OR id::text = $1
            LIMIT 1
        `, [messageId]);

        if (rows.length === 0) return false;

        let reactions = rows[0].reactions || [];
        // Filter out any existing reaction by 'me' (agent/system)
        // Ideally we should store WHO reacted better, but simplified for now: 'me'
        reactions = reactions.filter(r => r.by !== 'me');

        if (reaction) {
            reactions.push({ emoji: reaction, by: 'me' });
        }

        await pool.query(`
            UPDATE messages 
            SET reactions = $1::jsonb 
            WHERE id = $2
        `, [JSON.stringify(reactions), rows[0].id]);

        return true;
    }

    /**
     * Get a single message by ID or WhatsApp ID
     */
    async getMessageById(messageId) {
        const { rows } = await pool.query(`
            SELECT * FROM messages 
            WHERE whatsapp_id = $1 OR id::text = $1
            LIMIT 1
        `, [messageId]);
        return rows[0] || null;
    }

    /**
     * Delete a message by ID
     */
    /**
     * Delete a message by ID or WhatsApp ID
     */
    async deleteMessage(messageId) {
        // Soft deletion: update status to 'deleted' and clear content
        // We keep the record so it shows as "This message was deleted"
        const { rowCount } = await pool.query(`
            UPDATE messages 
            SET status = 'deleted', text_content = '🚫 Mensaje eliminado', media_url = NULL, media_type = NULL
            WHERE whatsapp_id = $1 OR id::text = $1
        `, [messageId]);

        return rowCount > 0;
    }
}

module.exports = new MessageService();
