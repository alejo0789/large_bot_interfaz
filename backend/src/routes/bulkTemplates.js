const express = require('express');
const router = express.Router();
const bulkTemplateService = require('../services/bulkTemplateService');
const { requireApiKey } = require('../middleware/apiKeyAuth');

// Ensure these queries are protected by API KEY, since we only use this internally

// Get all bulk templates
router.get('/', requireApiKey, async (req, res) => {
    try {
        const templates = await bulkTemplateService.getAll();
        res.json({ success: true, data: templates });
    } catch (err) {
        console.error('Error fetching bulk templates:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create a new bulk template
router.post('/', requireApiKey, async (req, res) => {
    const { name, content } = req.body;
    if (!name || !content) {
        return res.status(400).json({ success: false, message: 'Name and content are required' });
    }

    try {
        const template = await bulkTemplateService.create(name, content);
        res.status(201).json({ success: true, data: template });
    } catch (err) {
        console.error('Error creating bulk template:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update a bulk template
router.put('/:id', requireApiKey, async (req, res) => {
    const { id } = req.params;
    const { name, content } = req.body;

    try {
        const updatedTemplate = await bulkTemplateService.update(id, name, content);
        res.json({ success: true, data: updatedTemplate });
    } catch (err) {
        console.error('Error updating bulk template:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete a bulk template
router.delete('/:id', requireApiKey, async (req, res) => {
    const { id } = req.params;

    try {
        await bulkTemplateService.delete(id);
        res.json({ success: true, message: 'Template deleted' });
    } catch (err) {
        console.error('Error deleting bulk template:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
