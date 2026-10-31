const authService = require('../services/authService');

/**
 * Verify a user JWT or allow API-key-only access for trusted integrations.
 */
const jwtAuth = (req, res, next) => {
    // The CRM may send both credentials. Prefer the JWT so req.user is attached
    // and user-level authorization checks can run correctly.
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const decoded = authService.verifyToken(authHeader.substring(7));
        if (!decoded) {
            return res.status(401).json({ error: 'Sesion expirada o token invalido' });
        }
        req.user = decoded;
        return next();
    }

    const providedApiKey = req.headers['x-api-key'] || req.headers.system_api_key || req.headers['system-api-key'] || req.query.api_key;
    const systemApiKey = process.env.SYSTEM_API_KEY;
    if (systemApiKey && providedApiKey === systemApiKey) {
        return next();
    }

    return res.status(401).json({ error: 'Token no proporcionado o invalido' });
};

module.exports = jwtAuth;
