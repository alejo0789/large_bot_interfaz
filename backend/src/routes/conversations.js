/**
 * Conversation Routes
 * OPTIMIZED FOR 2000+ CONVERSATIONS with pagination
 */
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');
const n8nService = require('../services/n8nService');

/**
 * Get all conversations with pagination
 * Query params:
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 50, max: 100)
 *   - status: Filter by status (active/archived)
 *   - search: Search by contact name or phone
 *   - legacy: If true, returns flat array (backward compatibility)
 */
router.get('/', asyncHandler(async (req, res) => {
    const { page, limit, status, search, tagId, startDate, endDate, legacy, unreadOnly, leadTime } = req.query;

    const result = await conversationService.getAll({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        status: status || null,
        search: search || null,
        tagId: tagId || null,
        startDate: startDate || null,
        endDate: endDate || null,
        unreadOnly: unreadOnly === 'true',
        leadTime: leadTime || null
    });

    // Support legacy format for backward compatibility
    if (legacy === 'true') {
        console.log(`✅ Loaded ${result.data.length} conversations (legacy format)`);
        return res.json(result.data);
    }

    console.log(`✅ Loaded ${result.data.length}/${result.pagination.total} conversations (page ${result.pagination.page})`);
    res.json(result);
}));

/**
 * Get conversation statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const stats = await conversationService.getStats();
    res.json(stats);
}));

/**
 * Get lead classification statistics
 */
router.get('/lead-stats', asyncHandler(async (req, res) => {
    const stats = await conversationService.getLeadStats();
    res.json(stats);
}));

/**
 * Get daily agendas count
 */
router.get('/agendas-count', asyncHandler(async (req, res) => {
    const count = await conversationService.getDailyAgendasCount();
    res.json({ count });
}));

/**
 * Get messages for a conversation with pagination
 * Query params:
 *   - limit: Messages to load (default: 50, max: 200)
 *   - before: Load messages before this timestamp (cursor for infinite scroll)
 *   - after: Load messages after this timestamp (for new messages)
 *   - legacy: If true, returns flat array (backward compatibility)
 */
router.get('/:phone/messages', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    const { limit, before, after, legacy } = req.query;

    // If cursor is provided, use cursor-based pagination only (no initial load)
    if (before || after) {
        const cursorResult = await messageService.getByConversation(phone, {
            limit: parseInt(limit) || 30,
            before: before || null,
            after: after || null
        });

        console.log(`✅ Loaded ${cursorResult.data.length} messages for ${phone} (cursor: before=${before}, after=${after})`);
        return res.json(cursorResult);
    }

    const result = await messageService.getInitialMessages(phone, parseInt(limit) || 50);

    // Support legacy format for backward compatibility
    if (legacy === 'true') {
        console.log(`✅ Loaded ${result.data.length} messages for ${phone} (legacy format)`);
        return res.json(result.data);
    }

    console.log(`✅ Loaded ${result.data.length} messages for ${phone}`);
    res.json(result);
}));

/**
 * Get message count for a conversation
 */
router.get('/:phone/messages/count', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    const count = await messageService.getMessageCount(phone);
    res.json({ count });
}));

// Mark conversation as read
router.post('/:phone/mark-read', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    const evolutionService = require('../services/whatsappFactory');

    // Local update
    await conversationService.markAsRead(phone);

    // Evolution API update
    evolutionService.markAsRead(phone).catch(err =>
        console.warn(`⚠️ Could not mark as read on Evolution API for ${phone}:`, err.message)
    );

    console.log(`✅ Marked as read: ${phone}`);
    res.json({ success: true });
}));

// Mark conversation as unread
router.post('/:phone/mark-unread', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    const evolutionService = require('../services/whatsappFactory');

    // Local update
    await conversationService.markAsUnread(phone);

    // Evolution API update
    evolutionService.markAsUnread(phone).catch(err =>
        console.warn(`⚠️ Could not mark as unread on Evolution API for ${phone}:`, err.message)
    );

    console.log(`✅ Marked as unread: ${phone}`);
    res.json({ success: true });
}));

// Pin or unpin a conversation
router.put('/:phone/pin', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    const { isPinned } = req.body;

    const result = await conversationService.togglePin(phone, isPinned);

    if (!result) {
        return res.status(404).json({ success: false, error: 'Conversación no encontrada' });
    }

    console.log(`✅ ${isPinned ? 'Pinned' : 'Unpinned'} conversation: ${phone}`);
    res.json({ success: true, isPinned: result.is_pinned });
}));

// Toggle AI for conversation
router.post('/:phone/toggle-ai', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    const { aiEnabled } = req.body;

    const result = await conversationService.toggleAI(phone, aiEnabled);
    // await n8nService.notifyStateChange(phone, result.state); // Removed to prevent AI from greeting on toggle

    console.log(`✅ AI ${aiEnabled ? 'enabled' : 'disabled'} for ${phone}`);
    res.json({ success: true, ...result });
}));

// Take conversation by agent
router.post('/:phone/take-by-agent', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    const { agent_id } = req.body;

    await conversationService.takeByAgent(phone, agent_id);
    // await n8nService.notifyStateChange(phone, 'agent_active');

    console.log(`✅ Conversation taken by agent: ${phone}`);
    res.json({ success: true, state: 'agent_active' });
}));

// Reactivate AI
router.post('/:phone/activate-ai', asyncHandler(async (req, res) => {
    const { phone } = req.params;

    await conversationService.reactivateAI(phone);
    // await n8nService.notifyStateChange(phone, 'ai_active');

    console.log(`✅ AI reactivated for ${phone}`);
    res.json({ success: true, state: 'ai_active' });
}));

// Close conversation
router.post('/:phone/close', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    await conversationService.close(phone);
    console.log(`✅ Conversation closed: ${phone}`);
    res.json({ success: true, message: 'Conversación archivada' });
}));

// Get profile picture (avatar) proxy
router.get('/:phone/avatar', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    const evolutionService = require('../services/whatsappFactory');

    try {
        const pictureUrl = await evolutionService.getProfilePicture(phone);

        if (pictureUrl) {
            // Redirect directly to the WhatsApp image URL
            return res.redirect(pictureUrl);
        } else {
            return res.status(404).json({ error: 'Foto no encontrada' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Error interno obteniendo la foto' });
    }
}));

// Get conversation tags
router.get('/:phone/tags', asyncHandler(async (req, res) => {
    const tagService = require('../services/tagService');
    const { phone } = req.params;
    const tags = await tagService.getByConversation(phone);
    res.json(tags);
}));

// Assign tag to conversation
router.post('/:phone/tags', asyncHandler(async (req, res) => {
    const tagService = require('../services/tagService');
    const { phone } = req.params;
    const { tagId, agentId } = req.body;
    await tagService.assignToConversation(phone, tagId, agentId);
    res.json({ success: true });
}));

// Remove tag from conversation
router.delete('/:phone/tags/:tagId', asyncHandler(async (req, res) => {
    const tagService = require('../services/tagService');
    const { phone, tagId } = req.params;
    await tagService.removeFromConversation(phone, tagId);
    res.json({ success: true });
}));

// Update contact name
router.put('/:phone/name', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
        throw new AppError('El nombre es requerido', 400);
    }

    const conversation = await conversationService.updateContactName(phone, name);

    // Notificar cambio (opcional, pero buena práctica si tienes websockets)
    const n8nService = require('../services/n8nService'); // Lazy load avoid circular dependency if any

    res.json({ success: true, conversation });
}));

// Safe endpoint URL-agnostic
router.put('/update-contact-name', asyncHandler(async (req, res) => {
    const { phone, name } = req.body;

    if (!phone) {
        throw new AppError('El teléfono es requerido', 400);
    }
    if (!name || !name.trim()) {
        throw new AppError('El nombre es requerido', 400);
    }

    const conversation = await conversationService.updateContactName(phone, name);

    res.json({ success: true, conversation });
}));

// Start new conversation (check whatsapp first)
router.post('/start-new', asyncHandler(async (req, res) => {
    let { phone } = req.body;

    if (!phone) throw new AppError('Teléfono requerido', 400);

    // Clean phone for Evolution check
    // Evolution API expects numbers without + or special chars
    let cleanPhone = phone.replace(/\D/g, '');

    // Auto-prefix 57 for Colombia (10 digits)
    if (cleanPhone.length === 10) {
        cleanPhone = '57' + cleanPhone;
    }

    // Check Evolution
    const evolutionService = require('../services/whatsappFactory');
    const check = await evolutionService.checkNumber(cleanPhone);

    if (!check || !check.exists) {
        return res.status(404).json({
            success: false,
            message: 'El número no tiene WhatsApp o no es válido.'
        });
    }

    // Use the JID from Evolution to get the correct standard number
    let finalPhone = check.jid ? check.jid.split('@')[0] : cleanPhone;

    // Ideally we should check if DB uses '+'. Assuming standard format without '+' for now based on Evolution integration.
    // If your DB uses '+', prepend it here: finalPhone = '+' + finalPhone;

    const conversation = await conversationService.getOrCreate(finalPhone);

    res.json({ success: true, conversation });
}));

/**
 * Delete a conversation (DB + WhatsApp chat)
 * DELETE /api/conversations/:phone
 */
router.delete('/:phone', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    const evolutionService = require('../services/whatsappFactory');

    // 1. Delete from WhatsApp (non-blocking — don't fail if Evolution can't delete)
    const waResult = await evolutionService.deleteChat(phone).catch(err => ({
        success: false, warning: err.message
    }));

    // 2. Delete from DB (cascade: messages + tags + conversation)
    const deleted = await conversationService.deleteConversation(phone);

    if (!deleted) {
        return res.status(404).json({ success: false, message: 'Conversación no encontrada' });
    }

    console.log(`🗑️ Conversation deleted: ${phone} | WhatsApp: ${waResult.success ? '✅' : '⚠️ ' + (waResult.warning || waResult.error)}`);

    res.json({
        success: true,
        phone,
        whatsappDeleted: waResult.success,
        whatsappWarning: waResult.warning || null
    });
}));

/**
 * Get recipient count for bulk send preview
 * GET /api/conversations/recipients-count?tagId=X&startDate=ISO&endDate=ISO
 * Returns total count without pagination limits (for bulk send preview)
 */
router.get('/recipients-count', asyncHandler(async (req, res) => {
    const { tagId, startDate, endDate, leadTime } = req.query;
    const { pool } = require('../config/database');

    const conditions = [`c.status = 'active'`];
    const params = [];
    let paramIndex = 1;
    let joinClause = '';

    if (tagId) {
        joinClause = 'JOIN conversation_tags ct ON c.phone = ct.conversation_phone';
        conditions.push(`ct.tag_id = $${paramIndex++}`);
        params.push(tagId);
    }

    if (startDate) {
        conditions.push(`COALESCE(c.last_message_timestamp, c.created_at) >= $${paramIndex++}`);
        params.push(startDate);
    }

    if (endDate) {
        conditions.push(`COALESCE(c.last_message_timestamp, c.created_at) <= $${paramIndex++}`);
        params.push(endDate);
    }

    if (leadTime) {
        let leadTimes = [];
        if (Array.isArray(leadTime)) {
            leadTimes = leadTime;
        } else if (typeof leadTime === 'string') {
            leadTimes = leadTime.split(',');
        }
        
        if (leadTimes.length > 0) {
            const placeholders = leadTimes.map(() => `$${paramIndex++}`).join(', ');
            conditions.push(`c.lead_time IN (${placeholders})`);
            params.push(...leadTimes);
        }
    }

    const query = `
        SELECT COUNT(*) as total
        FROM conversations c
        ${joinClause}
        WHERE ${conditions.join(' AND ')}
    `;

    const { rows } = await pool.query(query, params);
    const total = parseInt(rows[0].total);

    res.json({ total, tagId: tagId || null, startDate: startDate || null, endDate: endDate || null, leadTime: leadTime || null });
}));

module.exports = router;



