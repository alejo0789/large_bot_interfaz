/**
 * Authentication Service
 * Handles agent login, registration, and token verification
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// JWT secret (should be in environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'chatbot_secret_key_change_in_production';
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days
const SALT_ROUNDS = 10;

class AuthService {
    /**
     * Login with username and password
     * @returns {Object} { success, token, user } or { success: false, error }
     */
    async login(username, password) {
        try {
            // Find agent by username
            const { rows } = await pool.query(
                'SELECT id, username, password_hash, name, email, is_active FROM agents WHERE username = $1',
                [username]
            );

            if (rows.length === 0) {
                return { success: false, error: 'Usuario no encontrado' };
            }

            const agent = rows[0];

            // Check if agent is active
            if (!agent.is_active) {
                return { success: false, error: 'Usuario desactivado' };
            }

            // Verify password
            const validPassword = await bcrypt.compare(password, agent.password_hash);
            if (!validPassword) {
                return { success: false, error: 'Contraseña incorrecta' };
            }

            // Update last login
            await pool.query(
                'UPDATE agents SET last_login = NOW() WHERE id = $1',
                [agent.id]
            );

            // Generate JWT token
            const token = jwt.sign(
                {
                    id: agent.id,
                    username: agent.username,
                    name: agent.name
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            return {
                success: true,
                token,
                user: {
                    id: agent.id,
                    username: agent.username,
                    name: agent.name,
                    email: agent.email
                }
            };
        } catch (error) {
            console.error('❌ Login error:', error);
            return { success: false, error: 'Error en el servidor' };
        }
    }

    /**
     * Register new agent
     */
    async register(username, password, name, email = null) {
        try {
            // Check if username exists
            const existing = await pool.query(
                'SELECT id FROM agents WHERE username = $1',
                [username]
            );

            if (existing.rows.length > 0) {
                return { success: false, error: 'El usuario ya existe' };
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

            // Insert new agent
            const { rows } = await pool.query(
                `INSERT INTO agents (username, password_hash, name, email) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING id, username, name, email`,
                [username, passwordHash, name, email]
            );

            console.log(`✅ New agent registered: ${username}`);

            return {
                success: true,
                user: rows[0]
            };
        } catch (error) {
            console.error('❌ Register error:', error);
            return { success: false, error: 'Error al registrar usuario' };
        }
    }

    /**
     * Verify JWT token
     * @returns {Object} Decoded token payload or null
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return null;
        }
    }

    /**
     * Get agent by ID
     */
    async getAgentById(id) {
        const { rows } = await pool.query(
            'SELECT id, username, name, email, is_active, created_at, last_login FROM agents WHERE id = $1',
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Get all agents
     */
    async getAllAgents() {
        const { rows } = await pool.query(
            'SELECT id, username, name, email, is_active, created_at, last_login FROM agents ORDER BY name'
        );
        return rows;
    }

    /**
     * Update agent
     */
    async updateAgent(id, { name, email, password }) {
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (name) {
            updates.push(`name = $${paramIndex++}`);
            params.push(name);
        }
        if (email) {
            updates.push(`email = $${paramIndex++}`);
            params.push(email);
        }
        if (password) {
            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
            updates.push(`password_hash = $${paramIndex++}`);
            params.push(passwordHash);
        }

        if (updates.length === 0) {
            return { success: false, error: 'No hay campos para actualizar' };
        }

        params.push(id);
        await pool.query(
            `UPDATE agents SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            params
        );

        return { success: true };
    }

    /**
     * Deactivate agent
     */
    async deactivateAgent(id) {
        await pool.query('UPDATE agents SET is_active = false WHERE id = $1', [id]);
        return { success: true };
    }
}

module.exports = new AuthService();
