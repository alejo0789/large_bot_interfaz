/**
 * Tag Routes
 */
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const tagService = require('../services/tagService');

// Get all tags
router.get('/', asyncHandler(async (req, res) => {
    const tags = await tagService.getAll();
    res.json(tags);
}));

// Create new tag
router.post('/', asyncHandler(async (req, res) => {
    const { name, color } = req.body;
    const tag = await tagService.create(name, color);
    res.json(tag);
}));

// Delete tag
router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    await tagService.delete(id);
    res.json({ success: true });
}));

module.exports = router;
