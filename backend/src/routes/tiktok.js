/**
 * TikTok Business Messaging webhook receiver.
 * TikTok sends all event notifications for authorized accounts to this app URL.
 */
const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const messageService = require('../services/messageService');
const conversationService = require('../services/conversationService');
const { pool, dbManager } = require('../config/database');
const tenantService = require('../services/tenantService');
const { tenantContext } = require('../utils/tenantContext');

let io = null;
const setSocketIO = (socketIO) => { io = socketIO; };

function verifyTikTokSignature(req) {
    const secret = process.env.TIKTOK_APP_SECRET;
    const signatureHeader = req.get('tiktok-signature');
    if (!secret || !signatureHeader || !Buffer.isBuffer(req.rawBody)) return false;

    const fields = Object.fromEntries(signatureHeader.split(',').map((part) => {
        const separator = part.indexOf('=');
        return separator < 0 ? [part.trim(), ''] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }));
    const timestamp = fields.t;
    const receivedSignature = fields.s;
    if (!timestamp || !/^[a-f\d]{64}$/i.test(receivedSignature || '')) return false;

    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

    const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), req.rawBody]);
    const expectedSignature = crypto.createHmac('sha256', secret).update(signedPayload).digest();
    const actualSignature = Buffer.from(receivedSignature, 'hex');
    return actualSignature.length === expectedSignature.length && crypto.timingSafeEqual(actualSignature, expectedSignature);
}

function parseEventContent(content) {
    if (typeof content !== 'string') return content && typeof content === 'object' ? content : {};
    try { return JSON.parse(content); } catch (_) { return {}; }
}

function firstText(...values) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (value && typeof value === 'object') {
            const nested = firstText(value.text, value.body, value.content, value.message);
            if (nested) return nested;
        }
    }
    return '';
}

function eventTimestamp(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return new Date().toISOString();
    return new Date(numeric < 1e12 ? numeric * 1000 : numeric).toISOString();
}

function emitIncomingMessage(tenantSlug, phone, message, contactName) {
    if (!io) return;
    io.to(`tenant:${tenantSlug}:conversation:${phone}`).emit('new-message', message);
    io.to(`tenant:${tenantSlug}:conversations:list`).emit('conversation-updated', {
        phone,
        lastMessage: message.message,
        timestamp: message.timestamp,
        contact_name: contactName,
        unread: 1,
        channel: 'tiktok'
    });
}

router.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'TikTok Business Messaging webhook is ready.' });
});

router.post('/', async (req, res) => {
    const logId = req.get('x-tt-logid') || 'unknown';
    try {
        if (!verifyTikTokSignature(req)) {
            return res.status(401).json({ error: 'Invalid TikTok webhook signature.' });
        }

        const body = req.body;
        const expectedAppId = process.env.TIKTOK_APP_ID;
        const receivedAppId = String(body?.client_key || body?.app_id || '');
        if (expectedAppId && receivedAppId && receivedAppId !== expectedAppId) {
            return res.status(403).json({ error: 'Webhook belongs to a different TikTok app.' });
        }

        const event = String(body?.event || body?.event_type || '');
        const content = parseEventContent(body?.content || body?.data);
        const message = content.message && typeof content.message === 'object' ? content.message : content;
        const conversationId = String(
            message.conversation_id || message.conversation_short_id || content.conversation_id || content.conversation_short_id || ''
        );
        const messageId = String(
            message.message_id || message.server_message_id || message.msg_id || content.message_id || content.server_message_id || ''
        );
        const text = firstText(
            message.text,
            message.message_content,
            message.content,
            content.message_content,
            content.text
        );
        const isIncomingMessage = /^(im_receive_msg|im_message_received|message_received|direct_message)$/i.test(event);

        // Acknowledge non-message events (for example delivery/read events) after
        // authenticating them; they do not create inbox conversations.
        if (!isIncomingMessage || !conversationId || !messageId || !text) {
            console.info(`[TikTok Webhook] Acknowledged event=${event || 'unknown'} log_id=${logId}`);
            return res.status(200).json({ code: 0, message: 'OK' });
        }

        const businessOpenId = String(body.user_openid || body.user_open_id || '');
        if (!businessOpenId) return res.status(400).json({ error: 'TikTok business account identifier is missing.' });

        const { rows: connections } = await dbManager.masterPool.query(
            `SELECT tenant_id, tenant_slug FROM tiktok_connections WHERE open_id = $1 LIMIT 1`,
            [businessOpenId]
        );
        const connection = connections[0];
        if (!connection) {
            console.warn(`[TikTok Webhook] No authorized workspace found for account; log_id=${logId}`);
            return res.status(200).json({ code: 0, message: 'Account is not linked.' });
        }

        const tenant = await tenantService.getTenantById(connection.tenant_id);
        if (!tenant) {
            console.warn(`[TikTok Webhook] Linked workspace is inactive; log_id=${logId}`);
            return res.status(200).json({ code: 0, message: 'Workspace is inactive.' });
        }

        const tenantPool = await dbManager.getPool(tenant.id, tenant.db_url);
        const phone = `tiktok_${conversationId}`;
        const contactName = String(
            message.sender_name || message.nick_name || content.sender_name || content.nick_name || 'Usuario TikTok'
        ).slice(0, 160);
        const timestamp = eventTimestamp(message.create_time || content.create_time || body.create_time);

        await tenantContext.run({ tenant, db: tenantPool }, async () => {
            const { rows: existing } = await pool.query(
                `SELECT id FROM messages WHERE whatsapp_id = $1 LIMIT 1`, [messageId]
            );
            if (existing.length) return;

            await conversationService.upsert(phone, contactName, 'tiktok');
            await pool.query(
                `UPDATE conversations SET channel = 'tiktok', updated_at = NOW() WHERE phone = $1`,
                [phone]
            );

            const savedMessage = await messageService.create({
                phone,
                sender: 'user',
                text,
                whatsappId: messageId,
                status: 'received',
                timestamp,
                senderName: contactName
            });
            await conversationService.updateLastMessage(phone, text, false);
            await conversationService.incrementUnread(phone);

            emitIncomingMessage(tenant.slug, phone, {
                message: {
                    id: savedMessage.id,
                    whatsapp_id: messageId,
                    conversation_phone: phone,
                    sender: 'user',
                    text_content: text,
                    status: 'received',
                    timestamp: savedMessage.timestamp || timestamp,
                    sender_name: contactName
                },
                contact_name: contactName,
                timestamp: savedMessage.timestamp || timestamp,
                unread: 1,
                channel: 'tiktok'
            }, contactName);
        });

        return res.status(200).json({ code: 0, message: 'OK' });
    } catch (error) {
        console.error(`[TikTok Webhook] Processing failed; log_id=${logId}:`, error.message);
        return res.status(500).json({ error: 'TikTok webhook processing failed.' });
    }
});

module.exports = { router, setSocketIO };
