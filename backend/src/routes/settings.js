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

// ─────────────────────────────────────────────
// GET /api/settings/whatsapp-status
// Check connection status for the current tenant's WhatsApp instance
// ─────────────────────────────────────────────
router.get('/whatsapp-status', asyncHandler(async (req, res) => {
    const tenant = req.tenant;
    if (!tenant) {
        return res.status(400).json({ success: false, error: 'Sede no especificada' });
    }

    if (tenant.whatsapp_provider === 'official') {
        return res.json({
            success: true,
            provider: 'official',
            connected: true,
            instanceName: tenant.name,
            state: 'open',
            message: 'Configurada con WhatsApp Oficial (Meta Cloud API)'
        });
    }

    const instanceName = tenant.evolution_instance;
    if (!instanceName) {
        return res.json({
            success: false,
            provider: 'evolution',
            connected: false,
            state: 'no_instance',
            error: 'Esta sede no tiene configurada una instancia de Evolution API.'
        });
    }

    const evolutionService = require('../services/evolutionService');
    const targetApiKey = tenant.evolution_api_key || evolutionService.getConfig().apiKey || evolutionService.globalApiKey;

    try {
        const url = `${evolutionService.baseUrl}/instance/connectionState/${instanceName}`;
        const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
        const response = await fetch(url, {
            headers: { 'apikey': targetApiKey }
        });
        const data = await response.json();

        const state = data?.instance?.state || data?.state || data?.status || 'close';
        const connected = state === 'open' || state === 'CONNECTED' || state === 'connected';

        res.json({
            success: true,
            provider: 'evolution',
            instanceName,
            connected,
            state,
            raw: data
        });
    } catch (err) {
        console.error('❌ Error checking whatsapp status:', err.message);
        res.json({
            success: false,
            provider: 'evolution',
            instanceName,
            connected: false,
            state: 'error',
            error: err.message
        });
    }
}));

// ─────────────────────────────────────────────
// GET /api/settings/whatsapp-qr
// Get QR code for the current tenant's Evolution instance
// ─────────────────────────────────────────────
router.get('/whatsapp-qr', asyncHandler(async (req, res) => {
    const tenant = req.tenant;
    if (!tenant) {
        return res.status(400).json({ success: false, error: 'Sede no especificada' });
    }

    const instanceName = tenant.evolution_instance;
    if (!instanceName) {
        return res.status(400).json({ success: false, error: 'Esta sede no tiene una instancia de Evolution API configurada.' });
    }

    const evolutionService = require('../services/evolutionService');
    const result = await evolutionService.getQR(instanceName);

    if (!result.success) {
        return res.status(400).json({ success: false, error: result.error || 'No se pudo obtener el código QR' });
    }

    const qrData = result.qr || {};
    const state = qrData?.instance?.state || qrData?.state || '';
    const isConnected = state === 'open' || qrData?.code === 'CONNECTED';

    let base64 = qrData.base64 || qrData.qrcode?.base64 || qrData.qr?.base64 || (typeof qrData.code === 'string' && qrData.code.startsWith('data:image') ? qrData.code : null);

    if (base64 && !base64.startsWith('data:image')) {
        base64 = `data:image/png;base64,${base64}`;
    }

    res.json({
        success: true,
        instanceName,
        connected: isConnected,
        state: isConnected ? 'open' : (state || 'connecting'),
        qr: base64,
        raw: qrData
    });
}));

// ─────────────────────────────────────────────
// POST /api/settings/whatsapp-restart
// Restart current tenant's Evolution API instance
// ─────────────────────────────────────────────
router.post('/whatsapp-restart', asyncHandler(async (req, res) => {
    const tenant = req.tenant;
    if (!tenant || !tenant.evolution_instance) {
        return res.status(400).json({ success: false, error: 'Instancia de Evolution no configurada en esta sede' });
    }

    const evolutionService = require('../services/evolutionService');
    const targetApiKey = tenant.evolution_api_key || evolutionService.getConfig().apiKey || evolutionService.globalApiKey;

    try {
        const url = `${evolutionService.baseUrl}/instance/restart/${tenant.evolution_instance}`;
        const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'apikey': targetApiKey }
        });
        const data = await response.json();

        res.json({ success: true, message: 'Instancia reiniciada correctamente', data });
    } catch (err) {
        console.error('❌ Error restarting evolution instance:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}));

module.exports = router;
