const { pool } = require('../config/database');

class BulkTemplateService {
    async getAll() {
        const result = await pool.query('SELECT * FROM bulk_templates ORDER BY created_at DESC');
        return result.rows;
    }

    async getById(id) {
        const result = await pool.query('SELECT * FROM bulk_templates WHERE id = $1', [id]);
        return result.rows[0];
    }

    async create(name, content) {
        const result = await pool.query(
            `INSERT INTO bulk_templates (name, content)
             VALUES ($1, $2) RETURNING *`,
            [name, content]
        );
        return result.rows[0];
    }

    async update(id, name, content) {
        const result = await pool.query(
            `UPDATE bulk_templates 
             SET name = COALESCE($1, name), 
                 content = COALESCE($2, content)
             WHERE id = $3 RETURNING *`,
            [name, content, id]
        );
        return result.rows[0];
    }

    async delete(id) {
        await pool.query('DELETE FROM bulk_templates WHERE id = $1', [id]);
        return true;
    }
}

module.exports = new BulkTemplateService();
