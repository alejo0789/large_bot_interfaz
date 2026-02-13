const { pool } = require('../config/database');

/**
 * Service to manage quick replies
 */
const quickReplyService = {
    /**
     * Get all quick replies
     */
    getAll: async () => {
        const result = await pool.query('SELECT * FROM quick_replies ORDER BY created_at DESC');
        return result.rows;
    },

    /**
     * Create a new quick reply
     * @param {string} shortcut - Short code/trigger
     * @param {string} content - Full message content
     * @param {string} mediaUrl - Optional media URL
     * @param {string} mediaType - Optional media type (image, video, etc)
     */
    create: async ({ shortcut, content, mediaUrl, mediaType }) => {
        const result = await pool.query(
            `INSERT INTO quick_replies (shortcut, content, media_url, media_type)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [shortcut, content, mediaUrl, mediaType]
        );
        return result.rows[0];
    },

    /**
     * Update an existing quick reply
     */
    update: async (id, { shortcut, content, mediaUrl, mediaType }) => {
        const result = await pool.query(
            `UPDATE quick_replies
             SET shortcut = COALESCE($1, shortcut),
                 content = COALESCE($2, content),
                 media_url = COALESCE($3, media_url),
                 media_type = COALESCE($4, media_type)
             WHERE id = $5
             RETURNING *`,
            [shortcut, content, mediaUrl, mediaType, id]
        );
        return result.rows[0];
    },

    /**
     * Delete a quick reply
     */
    delete: async (id) => {
        await pool.query('DELETE FROM quick_replies WHERE id = $1', [id]);
        return { success: true };
    }
};

module.exports = quickReplyService;
