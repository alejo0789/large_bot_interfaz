const express = require('express');
const jwtAuth = require('../middleware/jwtAuth');
const instagramService = require('../services/instagramService');
const tenantService = require('../services/tenantService');
const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');
const { dbManager } = require('../config/database');
const { tenantContext } = require('../utils/tenantContext');
const { normalizePhone, getPureDigits } = require('../utils/phoneUtils');
const { config } = require('../config/app');

const router = express.Router();
const webhookRouter = express.Router();
const ADMIN_ROLES = ['SUPER_ADMIN', 'SEDE_ADMIN', 'LOCAL_ADMIN'];
const callbackOrigin = () => {
    const urls = Array.isArray(config.frontendUrl) ? config.frontendUrl : [config.frontendUrl];
    try { return new URL(urls[0]).origin; } catch (_) { return 'http://localhost:3000'; }
};

function popup(success, message) {
    const origin = callbackOrigin();
    const safeMessage = String(message).replace(/[<>]/g, '');
    return `<!doctype html><html lang="es"><meta charset="utf-8"><title>Instagram CRM</title><body style="font:16px system-ui;padding:32px"><h2>${success ? 'Instagram conectado' : 'No se pudo conectar Instagram'}</h2><p>${safeMessage}</p><p>Puedes cerrar esta ventana y volver al CRM.</p><script>if(window.opener){window.opener.postMessage({type:'instagram-oauth-callback',success:${success}},${JSON.stringify(origin)});setTimeout(()=>window.close(),900)}</script></body></html>`;
}

router.post('/oauth/start', jwtAuth, async (req, res) => {
    try {
        if (!ADMIN_ROLES.includes(req.user?.role)) return res.status(403).json({ error: 'Solo administradores de la sede pueden conectar Instagram.' });
        if (!req.tenant?.id || !req.tenant?.slug) return res.status(400).json({ error: 'Selecciona una sede antes de conectar Instagram.' });
        if (req.user.role !== 'SUPER_ADMIN' && !req.user.tenants?.includes(req.tenant.slug)) return res.status(403).json({ error: 'No tienes acceso administrativo a esta sede.' });
        const authorizationUrl = await instagramService.createAuthorizationUrl({ tenant: req.tenant, user: req.user });
        res.json({ authorizationUrl });
    } catch (error) {
        console.error('[Instagram OAuth] Could not start:', error.message);
        res.status(500).json({ error: error.message });
    }
});

router.get('/oauth/status', jwtAuth, async (req, res) => {
    try {
        if (!req.tenant?.id) return res.status(400).json({ error: 'Selecciona una sede.' });
        res.json(await instagramService.getConnectionStatus(req.tenant.id));
    } catch (error) {
        console.error('[Instagram OAuth] Could not read status:', error.message);
        res.status(500).json({ error: 'No se pudo consultar la conexión de Instagram.' });
    }
});

router.get('/oauth/callback', async (req, res) => {
    if (req.query.error || req.query.error_description) return res.status(400).type('html').send(popup(false, 'Meta canceló o rechazó la autorización.'));
    if (typeof req.query.code !== 'string' || typeof req.query.state !== 'string') return res.status(400).type('html').send(popup(false, 'La respuesta de Meta llegó incompleta. Inicia la conexión de nuevo desde el CRM.'));
    try {
        const result = await instagramService.completeAuthorization({ state: req.query.state, code: req.query.code });
        res.status(200).type('html').send(popup(true, `Cuenta @${result.username || result.instagramUserId} conectada a ${result.tenantSlug}.`));
    } catch (error) {
        console.error('[Instagram OAuth] Callback failed:', error.response?.data?.error?.message || error.message);
        res.status(400).type('html').send(popup(false, error.response?.data?.error?.message || error.message));
    }
});

webhookRouter.get('/', (req, res) => {
    const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
    if (req.query['hub.mode'] === 'subscribe' && verifyToken && req.query['hub.verify_token'] === verifyToken) {
        return res.status(200).send(req.query['hub.challenge']);
    }
    return res.sendStatus(403);
});

webhookRouter.post('/', async (req, res) => {
    if (!instagramService.verifyWebhookSignature(req.rawBody, req.get('x-hub-signature-256'))) {
        console.warn('[Instagram Webhook] Rejected request: invalid or missing signature.');
        return res.sendStatus(403);
    }
    const body = req.body || {};
    if (!['instagram', 'page'].includes(body.object)) {
        console.warn(`[Instagram Webhook] Rejected unsupported object: ${String(body.object || 'missing')}.`);
        return res.sendStatus(404);
    }
    try {
        const entries = body.entry || [];
        console.info(`[Instagram Webhook] Received object=${body.object} entries=${entries.length}.`);
        if (process.env.INSTAGRAM_WEBHOOK_LOG_PAYLOAD === 'true') {
            console.info('[Instagram Webhook] Full payload:', JSON.stringify(body));
        }
        for (const entry of entries) {
            const accountId = String(entry.id || '');
            const connection = await instagramService.getConnectionByInstagramId(accountId);
            const events = entry.messaging || [];
            if (!connection) {
                console.warn(`[Instagram Webhook] No workspace connection matches entry.id=${String(entry.id || 'missing')} object=${body.object}.`);
                continue;
            }
            const tenant = await tenantService.getTenantById(connection.tenant_id);
            if (!tenant) {
                console.warn(`[Instagram Webhook] Connection matched entry.id=${entry.id}, but its workspace was not found.`);
                continue;
            }
            const db = await dbManager.getPool(tenant.id, tenant.db_url);
            await tenantContext.run({ tenant, db }, async () => {
                console.info(`[Instagram Webhook] Matched workspace=${tenant.slug} account.id=${accountId} messaging_events=${events.length}.`);
                for (const event of events) {
                    const incoming = event.message;
                    const senderId = event.sender?.id;
                    if (!incoming || incoming.is_echo || !senderId) {
                        console.info(`[Instagram Webhook] Ignored non-incoming event for account.id=${accountId}; has_message=${Boolean(incoming)} is_echo=${Boolean(incoming?.is_echo)} has_sender=${Boolean(senderId)}.`);
                        continue;
                    }
                    const phone = normalizePhone(`instagram_${senderId}`);
                    const providerId = incoming.mid || `ig_${Date.now()}_${senderId}`;
                    const existing = await db.query('SELECT 1 FROM messages WHERE whatsapp_id=$1 LIMIT 1', [providerId]);
                    if (existing.rows.length) {
                        console.info(`[Instagram Webhook] Duplicate message ignored for workspace=${tenant.slug}.`);
                        continue;
                    }
                    const profileName = event.sender?.username ? `@${event.sender.username}` : `Instagram ${senderId}`;
                    await conversationService.upsert(phone, profileName, 'instagram');
                    const text = incoming.text || (incoming.attachments?.length ? `[Adjunto de Instagram: ${incoming.attachments.map((a) => a.type || 'archivo').join(', ')}]` : '[Mensaje de Instagram]');
                    await messageService.create({ phone, sender: 'contact', text, whatsappId: providerId, status: 'delivered', timestamp: event.timestamp ? new Date(Number(event.timestamp)) : null, senderName: profileName });
                    await conversationService.updateLastMessage(phone, text, false);
                    await conversationService.incrementUnread(phone);
                    console.info(`[Instagram Webhook] Stored incoming message for workspace=${tenant.slug}.`);
                    const io = req.app.get('io');
                    if (io) {
                    const data = { whatsapp_id: providerId, phone, message: text, sender: 'user', sender_type: 'user', timestamp: new Date().toISOString(), contact_name: profileName, sender_name: profileName, unread: 1 };
                        io.to(`tenant:${tenant.slug}:conversation:${getPureDigits(phone)}`).emit('new-message', data);
                        io.to(`tenant:${tenant.slug}:conversations:list`).emit('conversation-updated', { phone, lastMessage: text, timestamp: data.timestamp, contact_name: profileName, unread: 1, sender_type: 'contact' });
                    }
                }
            });
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('[Instagram Webhook] Processing failed:', error.message);
        res.sendStatus(500);
    }
});

module.exports = { router, webhookRouter };
