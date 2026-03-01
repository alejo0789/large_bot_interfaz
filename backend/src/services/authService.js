const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { dbManager } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'chatbot_secret_key_change_in_production';
const JWT_EXPIRES_IN = '2h';
const SALT_ROUNDS = 10;

class AuthService {
    /**
     * Login with username and password against Master DB
     */
    async login(username, password) {
        try {
            const masterPool = dbManager.masterPool;

            const { rows } = await masterPool.query(
                `SELECT u.id, u.username, u.password_hash, u.full_name, u.email, u.role, u.is_active 
                 FROM users u WHERE u.username = $1`,
                [username]
            );

            if (rows.length === 0) return { success: false, error: 'Usuario no encontrado' };

            const user = rows[0];
            if (!user.is_active) return { success: false, error: 'Usuario desactivado' };

            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) return { success: false, error: 'Contraseña incorrecta' };

            // Get associated tenants
            const tenantsResult = await masterPool.query(
                `SELECT t.id, t.name, t.slug 
                 FROM tenants t
                 JOIN user_tenants ut ON t.id = ut.tenant_id
                 WHERE ut.user_id = $1 AND t.is_active = TRUE`,
                [user.id]
            );

            let allowedTenants = tenantsResult.rows;
            if (user.role === 'SUPER_ADMIN') {
                const allTenants = await masterPool.query('SELECT id, name, slug FROM tenants WHERE is_active = TRUE');
                allowedTenants = allTenants.rows;
            }

            await masterPool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role, tenants: allowedTenants.map(t => t.slug) },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            return {
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.full_name,
                    email: user.email,
                    role: user.role,
                    tenants: allowedTenants
                }
            };
        } catch (error) {
            console.error('❌ Login error:', error);
            return { success: false, error: 'Error en el servidor' };
        }
    }

    async register(username, password, name, email = null, role = 'OPERATOR') {
        try {
            const masterPool = dbManager.masterPool;
            const existing = await masterPool.query('SELECT id FROM users WHERE username = $1', [username]);
            if (existing.rows.length > 0) return { success: false, error: 'El usuario ya existe' };

            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
            const { rows } = await masterPool.query(
                `INSERT INTO users (username, password_hash, full_name, email, role) 
                 VALUES ($1, $2, $3, $4, $5) 
                 RETURNING id, username, full_name, email, role`,
                [username, passwordHash, name, email, role]
            );
            return { success: true, user: rows[0] };
        } catch (error) {
            console.error('❌ Register error:', error);
            return { success: false, error: 'Error al registrar usuario' };
        }
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return null;
        }
    }

    async getAgentById(id) {
        const masterPool = dbManager.masterPool;
        const { rows } = await masterPool.query(
            'SELECT id, username, full_name as name, email, role, is_active FROM users WHERE id = $1',
            [id]
        );
        const user = rows[0];
        if (!user) return null;

        let allowedTenants = [];
        if (user.role === 'SUPER_ADMIN') {
            const { rows: allTenants } = await masterPool.query('SELECT id, name, slug FROM tenants WHERE is_active = TRUE');
            allowedTenants = allTenants;
        } else {
            const { rows: tenantRows } = await masterPool.query(
                `SELECT t.id, t.name, t.slug FROM tenants t
                 JOIN user_tenants ut ON t.id = ut.tenant_id
                 WHERE ut.user_id = $1 AND t.is_active = TRUE`,
                [user.id]
            );
            allowedTenants = tenantRows;
        }
        return { ...user, tenants: allowedTenants };
    }

    async getAllAgents() {
        const masterPool = dbManager.masterPool;
        const { rows } = await masterPool.query(
            'SELECT id, username, full_name as name, email, role, is_active FROM users ORDER BY full_name'
        );
        return rows;
    }

    async updateAgent(id, { name, email, password }) {
        const masterPool = dbManager.masterPool;
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (name) { updates.push(`full_name = $${paramIndex++}`); params.push(name); }
        if (email) { updates.push(`email = $${paramIndex++}`); params.push(email); }
        if (password) {
            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
            updates.push(`password_hash = $${paramIndex++}`);
            params.push(passwordHash);
        }

        if (updates.length === 0) return { success: false, error: 'No hay campos para actualizar' };

        params.push(id);
        await masterPool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params);
        return { success: true };
    }

    async deactivateAgent(id) {
        const masterPool = dbManager.masterPool;
        await masterPool.query('UPDATE users SET is_active = false WHERE id = $1', [id]);
        return { success: true };
    }

    // ─────────────────────────────────────────────
    // ADMIN USER MANAGEMENT METHODS
    // ─────────────────────────────────────────────

    /** Get all users with sedes (SUPER_ADMIN) */
    async getAllUsersWithSedes() {
        const masterPool = dbManager.masterPool;
        const { rows } = await masterPool.query(`
            SELECT 
                u.id, u.username, u.full_name as name, u.email, u.role, u.is_active,
                u.created_at, u.last_login,
                COALESCE(
                    json_agg(json_build_object('id', t.id, 'name', t.name, 'slug', t.slug))
                    FILTER (WHERE t.id IS NOT NULL), '[]'
                ) as tenants
            FROM users u
            LEFT JOIN user_tenants ut ON u.id = ut.user_id
            LEFT JOIN tenants t ON ut.tenant_id = t.id AND t.is_active = TRUE
            GROUP BY u.id
            ORDER BY u.full_name
        `);
        return rows;
    }

    /** Get users by sede (slug). SEDE_ADMIN restricted to their own sede. */
    async getUsersBySede(sedeSlug, callerRole, callerUserId) {
        const masterPool = dbManager.masterPool;

        const { rows: tenantRows } = await masterPool.query(
            'SELECT id, name, slug FROM tenants WHERE slug = $1 AND is_active = TRUE', [sedeSlug]
        );
        if (tenantRows.length === 0) return { success: false, error: 'Sede no encontrada' };
        const tenant = tenantRows[0];

        if (callerRole === 'SEDE_ADMIN') {
            const { rows: m } = await masterPool.query(
                'SELECT 1 FROM user_tenants WHERE user_id = $1 AND tenant_id = $2', [callerUserId, tenant.id]
            );
            if (m.length === 0) return { success: false, error: 'No tienes permiso para ver esta sede', code: 403 };
        }

        const { rows } = await masterPool.query(`
            SELECT u.id, u.username, u.full_name as name, u.email, u.role, u.is_active, u.created_at, u.last_login
            FROM users u
            JOIN user_tenants ut ON u.id = ut.user_id
            WHERE ut.tenant_id = $1
            ORDER BY u.full_name
        `, [tenant.id]);

        return { success: true, users: rows, sede: tenant };
    }

    /** Create user and assign to sede */
    async createUserForSede(userData, sedeSlug, callerRole, callerUserId) {
        const masterPool = dbManager.masterPool;
        const { username, password, name, email, role = 'OPERATOR' } = userData;

        const allowedRoles = callerRole === 'SUPER_ADMIN'
            ? ['OPERATOR', 'SEDE_ADMIN', 'SUPER_ADMIN']
            : ['OPERATOR', 'SEDE_ADMIN'];

        if (!allowedRoles.includes(role)) {
            return { success: false, error: 'No tienes permiso para asignar este rol' };
        }

        const { rows: tenantRows } = await masterPool.query(
            'SELECT id, name, slug FROM tenants WHERE slug = $1 AND is_active = TRUE', [sedeSlug]
        );
        if (tenantRows.length === 0) return { success: false, error: 'Sede no encontrada' };
        const tenant = tenantRows[0];

        if (callerRole === 'SEDE_ADMIN') {
            const { rows: m } = await masterPool.query(
                'SELECT 1 FROM user_tenants WHERE user_id = $1 AND tenant_id = $2', [callerUserId, tenant.id]
            );
            if (m.length === 0) return { success: false, error: 'No puedes crear usuarios en esta sede', code: 403 };
        }

        const { rows: existing } = await masterPool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.length > 0) return { success: false, error: 'El nombre de usuario ya existe' };

        if (!password || password.length < 6) {
            return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' };
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const client = await masterPool.connect();
        try {
            await client.query('BEGIN');
            const { rows } = await client.query(
                `INSERT INTO users (username, password_hash, full_name, email, role) 
                 VALUES ($1, $2, $3, $4, $5) 
                 RETURNING id, username, full_name as name, email, role, is_active`,
                [username, passwordHash, name, email || null, role]
            );
            const newUser = rows[0];
            await client.query('INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1, $2)', [newUser.id, tenant.id]);
            await client.query('COMMIT');
            return { success: true, user: { ...newUser, sede: tenant } };
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('❌ createUserForSede error:', err);
            return { success: false, error: 'Error al crear usuario' };
        } finally {
            client.release();
        }
    }

    /** Toggle active status */
    async updateUserStatus(userId, isActive, callerRole, callerUserId) {
        const masterPool = dbManager.masterPool;

        if (parseInt(userId) === parseInt(callerUserId)) {
            return { success: false, error: 'No puedes desactivarte a ti mismo' };
        }

        if (callerRole === 'SEDE_ADMIN') {
            const { rows } = await masterPool.query(`
                SELECT 1 FROM user_tenants ut1
                JOIN user_tenants ut2 ON ut1.tenant_id = ut2.tenant_id
                WHERE ut1.user_id = $1 AND ut2.user_id = $2
            `, [callerUserId, userId]);
            if (rows.length === 0) return { success: false, error: 'Sin permiso para modificar este usuario', code: 403 };
        }

        await masterPool.query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, userId]);
        return { success: true };
    }

    /** Hard delete user */
    async deleteUser(userId, callerRole, callerUserId) {
        const masterPool = dbManager.masterPool;

        if (parseInt(userId) === parseInt(callerUserId)) {
            return { success: false, error: 'No puedes eliminarte a ti mismo' };
        }

        if (callerRole === 'SEDE_ADMIN') {
            const { rows } = await masterPool.query(`
                SELECT 1 FROM user_tenants ut1
                JOIN user_tenants ut2 ON ut1.tenant_id = ut2.tenant_id
                WHERE ut1.user_id = $1 AND ut2.user_id = $2
            `, [callerUserId, userId]);
            if (rows.length === 0) return { success: false, error: 'Sin permiso para eliminar este usuario', code: 403 };
        }

        const client = await masterPool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM user_tenants WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM users WHERE id = $1', [userId]);
            await client.query('COMMIT');
            return { success: true };
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('❌ deleteUser error:', err);
            return { success: false, error: 'Error al eliminar usuario' };
        } finally {
            client.release();
        }
    }

    /** Get all active tenants (for admin dropdowns) */
    async getAllTenants() {
        const masterPool = dbManager.masterPool;
        const { rows } = await masterPool.query(
            'SELECT id, name, slug FROM tenants WHERE is_active = TRUE ORDER BY name'
        );
        return rows;
    }
}

module.exports = new AuthService();
