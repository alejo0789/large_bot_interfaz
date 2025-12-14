/**
 * Route Index
 * Exports all routes
 */
const conversationRoutes = require('./conversations');
const tagRoutes = require('./tags');
const { router: messageRoutes, setSocketIO: setMessageSocketIO } = require('./messages');
const { router: webhookRoutes, setSocketIO: setWebhookSocketIO } = require('./webhooks');

module.exports = {
    conversationRoutes,
    tagRoutes,
    messageRoutes,
    webhookRoutes,
    setMessageSocketIO,
    setWebhookSocketIO
};
