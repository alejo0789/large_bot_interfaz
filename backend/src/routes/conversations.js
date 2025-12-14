/**
 * Conversation Routes
 */
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');
const n8nService = require('../services/n8nService');

// Get all conversations
router.get('/', asyncHandler(async (req, res) => {
    const conversations = await conversationService.getAll();
    console.log(`✅ Loaded ${conversations.length} conversations`);
    res.json(conversations);
}));

// Get messages for a conversation
router.get('/:phone/messages', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    const messages = await messageService.getByConversation(phone);
    console.log(`✅ Loaded ${messages.length} messages for ${phone}`);
    res.json(messages);
}));

// Mark conversation as read
router.post('/:phone/mark-read', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    await conversationService.markAsRead(phone);
    console.log(`✅ Marked as read: ${phone}`);
    res.json({ success: true });
}));

// Toggle AI for conversation
router.post('/:phone/toggle-ai', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    const { aiEnabled } = req.body;

    const result = await conversationService.toggleAI(phone, aiEnabled);
    await n8nService.notifyStateChange(phone, result.state);

    console.log(`✅ AI ${aiEnabled ? 'enabled' : 'disabled'} for ${phone}`);
    res.json({ success: true, ...result });
}));

// Take conversation by agent
router.post('/:phone/take-by-agent', asyncHandler(async (req, res) => {
    const { phone } = req.params;
    const { agent_id } = req.body;

    await conversationService.takeByAgent(phone, agent_id);
    await n8nService.notifyStateChange(phone, 'agent_active');

    console.log(`✅ Conversation taken by agent: ${phone}`);
    res.json({ success: true, state: 'agent_active' });
}));

// Reactivate AI
router.post('/:phone/activate-ai', asyncHandler(async (req, res) => {
    const { phone } = req.params;

    await conversationService.reactivateAI(phone);
    await n8nService.notifyStateChange(phone, 'ai_active');

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
    const { tagId } = req.body;
    await tagService.assignToConversation(phone, tagId);
    res.json({ success: true });
}));

// Remove tag from conversation
router.delete('/:phone/tags/:tagId', asyncHandler(async (req, res) => {
    const tagService = require('../services/tagService');
    const { phone, tagId } = req.params;
    await tagService.removeFromConversation(phone, tagId);
    res.json({ success: true });
}));

module.exports = router;
