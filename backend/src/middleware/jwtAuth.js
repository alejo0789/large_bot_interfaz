const authService = require('../services/authService');

/**
 * Middleware to verify JWT token
 */
const jwtAuth = (req, res, next) => {
    // 1. Allow bypass if a valid SYSTEM_API_KEY is provided (for n8n/integrations)
    const providedApiKey = req.headers['x-api-key'] || req.query.api_key;
    const systemApiKey = process.env.SYSTEM_API_KEY;

    if (systemApiKey && providedApiKey === systemApiKey) {
        return next();
    }

    // 2. Otherwise, require a valid JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token no proporcionado o inválido' });
    }

    const token = authHeader.substring(7);
    const decoded = authService.verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Sesión expirada o token inválido' });
    }

    // Attach user info to request
    req.user = decoded;
    next();
};

module.exports = jwtAuth;
