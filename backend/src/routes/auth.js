/**
 * Authentication Routes
 * Handles login, logout, and user info
 */
const express = require('express');
const router = express.Router();
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const authService = require('../services/authService');

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        throw new AppError('Usuario y contraseña son requeridos', 400);
    }

    const result = await authService.login(username, password);

    if (!result.success) {
        throw new AppError(result.error, 401);
    }

    console.log(`✅ Agent logged in: ${username}`);

    res.json({
        success: true,
        token: result.token,
        user: result.user
    });
}));

/**
 * POST /api/auth/register
 * Register new agent
 */
router.post('/register', asyncHandler(async (req, res) => {
    const { username, password, name, email } = req.body;

    if (!username || !password || !name) {
        throw new AppError('Usuario, contraseña y nombre son requeridos', 400);
    }

    if (password.length < 6) {
        throw new AppError('La contraseña debe tener al menos 6 caracteres', 400);
    }

    const result = await authService.register(username, password, name, email);

    if (!result.success) {
        throw new AppError(result.error, 400);
    }

    res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        user: result.user
    });
}));

/**
 * GET /api/auth/me
 * Get current user info (requires token in header)
 */
router.get('/me', asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('Token no proporcionado', 401);
    }

    const token = authHeader.substring(7);
    const decoded = authService.verifyToken(token);

    if (!decoded) {
        throw new AppError('Token inválido o expirado', 401);
    }

    const agent = await authService.getAgentById(decoded.id);

    if (!agent) {
        throw new AppError('Usuario no encontrado', 404);
    }

    res.json({
        success: true,
        user: agent
    });
}));

/**
 * GET /api/auth/agents
 * Get all agents (for admin purposes)
 */
router.get('/agents', asyncHandler(async (req, res) => {
    const agents = await authService.getAllAgents();
    res.json(agents);
}));

/**
 * POST /api/auth/logout
 * Logout (client-side token removal, this is just for logging)
 */
router.post('/logout', asyncHandler(async (req, res) => {
    // JWT is stateless, so logout is handled client-side
    // This endpoint is for logging purposes
    console.log('👋 Agent logged out');
    res.json({ success: true, message: 'Sesión cerrada' });
}));

/**
 * PUT /api/auth/profile
 * Update current user profile / password
 */
router.put('/profile', asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('Token no proporcionado', 401);
    }

    const token = authHeader.substring(7);
    const decoded = authService.verifyToken(token);

    if (!decoded) {
        throw new AppError('Token inválido o expirado', 401);
    }

    const { name, email, password } = req.body;
    const result = await authService.updateAgent(decoded.id, { name, email, password });

    if (!result.success) {
        throw new AppError(result.error || 'Error al actualizar perfil', 400);
    }

    const updatedAgent = await authService.getAgentById(decoded.id);

    res.json({ success: true, message: 'Perfil actualizado exitosamente', user: updatedAgent });
}));

module.exports = router;
