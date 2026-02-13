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
                agent_name
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
                mediaType: msg.media_type || null,
                mediaUrl: msg.media_url || null,
                agentId: msg.agent_id,
                agentName: msg.agent_name
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
    async create({ phone, sender, text, whatsappId, mediaType, mediaUrl, status = 'delivered', agentId, agentName }) {
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
                agent_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
            RETURNING id, timestamp
        `, [phone, sender, text, whatsappId, mediaType, mediaUrl, status, agentId, agentName]);

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
}

module.exports = new MessageService();

