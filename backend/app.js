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

// Middleware
const { errorHandler } = require('./src/middleware/errorHandler');

// Routes
const conversationRoutes = require('./src/routes/conversations');
const tagRoutes = require('./src/routes/tags');
const authRoutes = require('./src/routes/auth');
const { router: messageRoutes, setSocketIO: setMessageSocketIO } = require('./src/routes/messages');
const { router: webhookRoutes, setSocketIO: setWebhookSocketIO } = require('./src/routes/webhooks');
const { router: evolutionRoutes, setSocketIO: setEvolutionSocketIO } = require('./src/routes/evolution');
const settingsRoutes = require('./src/routes/settings');
const quickReplyRoutes = require('./src/routes/quickReplies');

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
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api', messageRoutes);
app.use('/webhook', webhookRoutes);
app.use('/evolution', evolutionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/quick-replies', quickReplyRoutes);
app.use('/api/ai-knowledge', require('./src/routes/ai_knowledge'));

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
// SOCKET.IO - OPTIMIZED FOR 2000+ CONVERSATIONS
// =============================================

// Track connected clients for monitoring
let connectedClients = 0;

io.on('connection', (socket) => {
    connectedClients++;
    console.log(`🔌 Client connected: ${socket.id} (Total: ${connectedClients})`);

    socket.on('disconnect', () => {
        connectedClients--;
        console.log(`🔌 Client disconnected: ${socket.id} (Total: ${connectedClients})`);
    });

    // Join conversation room (for viewing a specific chat)
    socket.on('join-conversation', (phone) => {
        // Leave any previous conversation rooms first
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
            if (room.startsWith('conversation:') && room !== `conversation:${phone}`) {
                socket.leave(room);
            }
        });

        socket.join(`conversation:${phone}`);
        console.log(`📱 Socket ${socket.id} joined conversation: ${phone}`);
    });

    // Leave conversation room
    socket.on('leave-conversation', (phone) => {
        socket.leave(`conversation:${phone}`);
        console.log(`📱 Socket ${socket.id} left conversation: ${phone}`);
    });

    // Join conversations list room (for receiving list updates)
    socket.on('join-conversations-list', () => {
        socket.join('conversations:list');
        console.log(`📋 Socket ${socket.id} joined conversations list`);
    });

    // Leave conversations list room
    socket.on('leave-conversations-list', () => {
        socket.leave('conversations:list');
    });

    // Get current room info (for debugging)
    socket.on('get-rooms', (callback) => {
        if (typeof callback === 'function') {
            callback(Array.from(socket.rooms));
        }
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
        console.log(`📁 Creating upload directory: ${config.uploadDir}`);
        fs.mkdirSync(config.uploadDir, { recursive: true });
    }

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
        console.log(`🌐 Allowed Origins: ${Array.isArray(config.frontendUrl) ? config.frontendUrl.join(', ') : config.frontendUrl}`);
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
