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

// Config
const { config, validateConfig } = require('./src/config/app');
const { testConnection } = require('./src/config/database');

// Middleware
const { errorHandler } = require('./src/middleware/errorHandler');

// Routes
const conversationRoutes = require('./src/routes/conversations');
const tagRoutes = require('./src/routes/tags');
const { router: messageRoutes, setSocketIO: setMessageSocketIO } = require('./src/routes/messages');
const { router: webhookRoutes, setSocketIO: setWebhookSocketIO } = require('./src/routes/webhooks');

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

// =============================================
// MIDDLEWARE
// =============================================

// CORS
app.use(cors({
    origin: config.frontendUrl,
    credentials: true
}));

// JSON parsing
app.use(express.json({ limit: '10mb' }));

// Static files (uploads)
app.use('/uploads', express.static(config.uploadDir));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    res.charset = 'utf-8';
    next();
});

// =============================================
// ROUTES
// =============================================

// API Routes
app.use('/api/conversations', conversationRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api', messageRoutes);
app.use('/webhook', webhookRoutes);

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
// SOCKET.IO
// =============================================

io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });

    // Join conversation room
    socket.on('join-conversation', (phone) => {
        socket.join(`conversation:${phone}`);
        console.log(`📱 Socket joined conversation: ${phone}`);
    });

    // Leave conversation room
    socket.on('leave-conversation', (phone) => {
        socket.leave(`conversation:${phone}`);
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

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
        console.error('❌ Cannot start server without database connection');
        process.exit(1);
    }

    // Start listening
    server.listen(config.port, () => {
        console.log('');
        console.log('🚀 ================================');
        console.log('🚀 CHATBOT BACKEND SERVER');
        console.log('🚀 ================================');
        console.log(`📡 Server running on port ${config.port}`);
        console.log(`🌐 Frontend URL: ${config.frontendUrl}`);
        console.log(`📁 Upload dir: ${config.uploadDir}`);
        console.log(`🔧 Environment: ${config.nodeEnv}`);
        console.log('🚀 ================================');
        console.log('');
    });
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
    process.exit(1);
});

// Start the server
startServer();

module.exports = { app, io };
