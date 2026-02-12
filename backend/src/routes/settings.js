const express = require('express');
const router = express.Router();
const settingsService = require('../services/settingsService');
const { asyncHandler } = require('../middleware/errorHandler');

// Get all settings
router.get('/', asyncHandler(async (req, res) => {
    const settings = await settingsService.getAll();
    res.json({ success: true, settings });
}));

// Update a setting
router.post('/', asyncHandler(async (req, res) => {
    const { key, value, applyToExisting } = req.body;
    if (!key) {
        return res.status(400).json({ success: false, error: 'Key is required' });
    }

    await settingsService.set(key, value);

    if (key === 'default_ai_enabled' && applyToExisting) {
        const conversationService = require('../services/conversationService');
        await conversationService.setAllAI(String(value) === 'true');
    }

    res.json({ success: true, message: 'Setting updated' });
}));

module.exports = router;
