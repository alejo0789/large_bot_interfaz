/**
 * Chatbot Backend Server
 * Refactored with modular architecture
 * 
 * Structure:
 * - src/config/     - Configuration files
 * - src/services/   - Business logic
 * - src/routes/     - API endpoints
 * - src/middleware/ - Express middleware
 * - src/utils/      - Utility functions
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// Config
const { config, validateConfig } = require('./src/config/app');
const { testConnection } = require('./src/config/database');

// Jobs
const { startTimeTrackerJob } = require('./src/jobs/timeTrackerJob');

// Middleware
const { errorHandler } = require('./src/middleware/errorHandler');
const tenantMiddleware = require('./src/middleware/tenantMiddleware');

// Routes
const authRoutes = require('./src/routes/auth');
const conversationRoutes = require('./src/routes/conversations');
const tagRoutes = require('./src/routes/tags');
const { router: messageRoutes, setSocketIO: setMessageSocketIO } = require('./src/routes/messages');
const { router: webhookRoutes, setSocketIO: setWebhookSocketIO } = require('./src/routes/webhooks');
const { router: evolutionRoutes, setSocketIO: setEvolutionSocketIO } = require('./src/routes/evolution');
const { router: whatsappOfficialRoutes, setSocketIO: setWhatsappOfficialSocketIO } = require('./src/routes/whatsappOfficial');
const settingsRoutes = require('./src/routes/settings');
const quickReplyRoutes = require('./src/routes/quickReplies');

// ... (existing imports skipped) ...

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: config.frontendUrl,
        methods: ['GET', 'POST']
    }
});

// Pass Socket.IO to routes that need it
setMessageSocketIO(io);
setWebhookSocketIO(io);
setEvolutionSocketIO(io);
setWhatsappOfficialSocketIO(io);

// =============================================
// MIDDLEWARE
// =============================================

// CORS
// (OMISSIONS FOR BREVITY, KEEPING THE LOGIC)
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (config.nodeEnv === 'development') return callback(null, true);
        const allowedOrigins = Array.isArray(config.frontendUrl) ? config.frontendUrl : [config.frontendUrl];
        if (allowedOrigins.indexOf(origin) !== -1) callback(null, true);
        else callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// JSON parsing
app.use(express.json({ limit: '10mb' }));

// 1. Static files (uploads) - MUST BE FIRST to avoid tenant middleware interference
app.use('/uploads', express.static(config.uploadDir));

// 2. Request logging
app.use((req, res, next) => {
    // Skip logging for static files to keep logs clean
    if (!req.path.startsWith('/uploads')) {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    }
    res.charset = 'utf-8';
    next();
});

// =============================================
// ROUTES
// =============================================

// Public Routes
app.use('/api/auth', authRoutes);

// Admin Routes (no requieren sede / tenant context)
const adminRoutes = require('./src/routes/userManagement');
app.use('/api/admin', adminRoutes);

// --- MULTI-TENANT MIDDLEWARE ---
// Apply to all subsequent routes
app.use(tenantMiddleware);

// Protected Tenant Routes
app.use('/api/conversations', conversationRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api', messageRoutes);
app.use('/webhook', webhookRoutes);
app.use('/evolution', evolutionRoutes);
app.use('/webhook/meta', whatsappOfficialRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/quick-replies', quickReplyRoutes);
app.use('/api/bulk-templates', require('./src/routes/bulkTemplates'));
app.use('/api/ai-knowledge', require('./src/routes/ai_knowledge'));
app.use('/api/dashboard', require('./src/routes/dashboard'));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

// Legacy webhook support (backwards compatibility)
app.post('/api/receive-message', (req, res, next) => {
    req.url = '/webhook/receive-message';
    webhookRoutes.handle(req, res, next);
});

// =============================================
// SOCKET.IO - MT AWARE
// =============================================

io.on('connection', (socket) => {
    const { token, tenantSlug } = socket.handshake.auth;

    if (!token || !tenantSlug) {
        console.log(`🔌 Connection rejected: missing credentials for socket ${socket.id}`);
        socket.disconnect(true);
        return;
    }

    console.log(`🔌 Client connected to tenant [${tenantSlug}]: ${socket.id}`);
    socket.join(`tenant:${tenantSlug}`);

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected from tenant [${tenantSlug}]: ${socket.id}`);
    });

    // Join conversation room
    socket.on('join-conversation', (phone) => {
        // Leave previous conversation rooms in THIS tenant
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
            if (room.startsWith(`tenant:${tenantSlug}:conversation:`)) {
                socket.leave(room);
            }
        });

        const purePhone = String(phone).replace(/\D/g, '');
        socket.join(`tenant:${tenantSlug}:conversation:${purePhone}`);
        console.log(`📱 Socket ${socket.id} joined conversation: ${purePhone} in tenant ${tenantSlug}`);
    });

    // Join conversations list room
    socket.on('join-conversations-list', () => {
        socket.join(`tenant:${tenantSlug}:conversations:list`);
        console.log(`📋 Socket ${socket.id} joined conversations list for tenant ${tenantSlug}`);
    });
});

// =============================================
// ERROR HANDLING
// =============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Global error handler
app.use(errorHandler);

// =============================================
// START SERVER
// =============================================

const startServer = async () => {
    // Validate configuration
    validateConfig();

    // Ensure upload directory exists
    if (!fs.existsSync(config.uploadDir)) {
        console.log(`ðŸ“ Creating upload directory: ${config.uploadDir}`);
        fs.mkdirSync(config.uploadDir, { recursive: true });
    }

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
        console.error('❌ Cannot start server without database connection');
        process.exit(1);
    }

    // Start background jobs
    startTimeTrackerJob();

    // Start listening
    server.listen(config.port, () => {
        console.log('');
        console.log('ðŸš€ ================================');
        console.log('ðŸš€ CHATBOT BACKEND SERVER');
        console.log('ðŸš€ ================================');
        console.log(`ðŸ“¡ Server running on port ${config.port}`);
        console.log(`ðŸŒ Allowed Origins: ${Array.isArray(config.frontendUrl) ? config.frontendUrl.join(', ') : config.frontendUrl}`);
        console.log(`ðŸ“ Upload dir: ${config.uploadDir}`);
        console.log(`ðŸ”§ Environment: ${config.nodeEnv}`);
        console.log('ðŸš€ ================================');
        console.log('');
    });
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('âŒ Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('âŒ Unhandled Rejection:', err);
    process.exit(1);
});

// Start the server
startServer();

module.exports = { app, io };
