const { AppError } = require('./errorHandler');
const { config } = require('../config/app');

/**
 * Middleware para requerir una API Key válida
 * Protege contra envíos de mensajes no autorizados
 */
const requireApiKey = (req, res, next) => {
    // 1. Obtener la key de los headers o query params
    const providedKey = req.headers['x-api-key'] || req.query.api_key;

    // 2. Obtener la key del sistema (de las variables de entorno)
    const systemKey = process.env.SYSTEM_API_KEY;

    // Si no hay key configurada en el servidor, mostrar advertencia pero dejar pasar (modo desarrollo)
    // Opcional: Podríamos bloquearlo siempre, pero por seguridad es mejor exigir la configuración.
    if (!systemKey) {
        console.warn('⚠️ ADVERTENCIA DE SEGURIDAD: SYSTEM_API_KEY no está configurada en el servidor. El endpoint está público.');
        return next();
    }

    // 3. Validar
    if (!providedKey || providedKey !== systemKey) {
        return next(new AppError('Acceso denegado. API Key inválida o faltante.', 401));
    }

    // Si es válida, continuar al controlador
    next();
};

module.exports = { requireApiKey };
