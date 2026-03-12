/**
 * Tag Service
 * Business logic for tags
 */

const { pool } = require('../config/database');

class TagService {
    /**
     * Get all tags
     */
    async getAll() {
        const { rows } = await pool.query('SELECT * FROM tags ORDER BY name ASC');
        return rows;
    }

    /**
     * Create a new tag
     */
    async create(name, color = '#808080') {
        const { rows } = await pool.query(`
            INSERT INTO tags (name, color) VALUES ($1, $2) 
            ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color
            RETURNING *
        `, [name, color]);
        return rows[0];
    }

    /**
     * Get tags for a conversation
     */
    async getByConversation(phone) {
        const { rows } = await pool.query(`
            SELECT t.* FROM tags t
            JOIN conversation_tags ct ON t.id = ct.tag_id
            WHERE ct.conversation_phone = $1
            ORDER BY t.name ASC
        `, [phone]);
        return rows;
    }

    /**
     * Assign tag to conversation
     */
    async assignToConversation(phone, tagId, agentId = null) {
        await pool.query(`
            INSERT INTO conversation_tags (conversation_phone, tag_id, assigned_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (conversation_phone, tag_id) DO UPDATE SET assigned_by = EXCLUDED.assigned_by
        `, [phone, tagId, agentId]);

        // Special logic: If tag is "Agendar", clear lead_time (it's no longer a lead to follow up)
        const { rows: tagRows } = await pool.query('SELECT name FROM tags WHERE id = $1', [tagId]);
        if (tagRows.length > 0 && tagRows[0].name.toLowerCase() === 'agendar') {
            await pool.query(`
                UPDATE conversations 
                SET 
                    lead_time = NULL,
                    conversation_state = 'agent_active',
                    agent_id = $1,
                    updated_at = NOW()
                WHERE phone = $2
            `, [agentId || 'system', phone]);
            console.log(`✅ Conversation ${phone} marked as 'Agendada' (lead_time cleared) by agent ${agentId}`);
        }
    }

    /**
     * Remove tag from conversation
     */
    async removeFromConversation(phone, tagId) {
        // Get tag name before deleting
        const { rows: tagRows } = await pool.query('SELECT name FROM tags WHERE id = $1', [tagId]);
        
        await pool.query(`
            DELETE FROM conversation_tags 
            WHERE conversation_phone = $1 AND tag_id = $2
        `, [phone, tagId]);

        // If tag was "Agendar", restore state to ai_active so it becomes a lead again
        if (tagRows.length > 0 && tagRows[0].name.toLowerCase() === 'agendar') {
            await pool.query(`
                UPDATE conversations 
                SET 
                    conversation_state = 'ai_active',
                    updated_at = NOW()
                WHERE phone = $1
            `, [phone]);
            console.log(`✅ Conversation ${phone} 'Agendada' tag removed. State restored to ai_active.`);
        }
    }

    /**
     * Delete a tag
     */
    async delete(tagId) {
        await pool.query('DELETE FROM conversation_tags WHERE tag_id = $1', [tagId]);
        await pool.query('DELETE FROM tags WHERE id = $1', [tagId]);
    }

    /**
     * Update a tag
     */
    async update(tagId, name, color) {
        const { rows } = await pool.query(`
            UPDATE tags 
            SET name = COALESCE($2, name), 
                color = COALESCE($3, color)
            WHERE id = $1
            RETURNING *
        `, [tagId, name, color]);
        return rows[0];
    }
}

module.exports = new TagService();
