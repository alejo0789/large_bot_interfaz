/**
 * Application Configuration
 * Centralized configuration management
 */
const path = require('path');

const config = {
    // Server
    port: process.env.PORT || 4000,
    nodeEnv: process.env.NODE_ENV || 'development',

    // CORS
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

    // File uploads
    uploadDir: path.join(__dirname, '../../uploads'),
    maxFileSize: 16 * 1024 * 1024, // 16MB
    allowedFileTypes: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/quicktime', 'video/webm',
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],

    // N8N Integration
    n8nWebhookUrl: process.env.N8N_SEND_WEBHOOK_URL || null,
    n8nReceiveUrl: process.env.N8N_RECEIVE_WEBHOOK_URL || null,

    // Logging
    logLevel: process.env.LOG_LEVEL || 'info'
};

// Validate required config
const validateConfig = () => {
    const warnings = [];

    if (!config.n8nWebhookUrl) {
        warnings.push('N8N_SEND_WEBHOOK_URL not configured - messages will not be sent to WhatsApp');
    }

    if (warnings.length > 0) {
        console.warn('⚠️ Configuration warnings:');
        warnings.forEach(w => console.warn(`   - ${w}`));
    }

    return warnings.length === 0;
};

module.exports = { config, validateConfig };
