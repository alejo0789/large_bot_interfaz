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
    async assignToConversation(phone, tagId) {
        await pool.query(`
            INSERT INTO conversation_tags (conversation_phone, tag_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
        `, [phone, tagId]);
    }

    /**
     * Remove tag from conversation
     */
    async removeFromConversation(phone, tagId) {
        await pool.query(`
            DELETE FROM conversation_tags 
            WHERE conversation_phone = $1 AND tag_id = $2
        `, [phone, tagId]);
    }

    /**
     * Delete a tag
     */
    async delete(tagId) {
        await pool.query('DELETE FROM conversation_tags WHERE tag_id = $1', [tagId]);
        await pool.query('DELETE FROM tags WHERE id = $1', [tagId]);
    }
}

module.exports = new TagService();
