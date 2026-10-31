const express = require('express');
const router = express.Router();
const jwtAuth = require('../middleware/jwtAuth');
const tiktokOAuthService = require('../services/tiktokOAuthService');
const { config } = require('../config/app');

const callbackHtml = (success, message) => {
    const configuredOrigins = Array.isArray(config.frontendUrl) ? config.frontendUrl : [config.frontendUrl];
    let frontendOrigin = 'http://localhost:3000';
    try {
        frontendOrigin = new URL(configuredOrigins[0]).origin;
    } catch (_) {}
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TikTok authorization</title><body style="font-family:system-ui,sans-serif;background:#f5f7fa;color:#17202a;display:grid;place-items:center;min-height:100vh;margin:0"><main style="background:white;border:1px solid #e5e7eb;border-radius:16px;padding:32px;max-width:440px;margin:20px"><h1 style="font-size:22px;color:${success ? '#0f766e' : '#b91c1c'}">${success ? 'TikTok account connected' : 'TikTok connection failed'}</h1><p>${message}</p><p style="color:#6b7280;font-size:13px">You can close this window and return to the CRM.</p></main><script>if(window.opener){window.opener.postMessage({type:'tiktok-oauth-callback',success:${success}},${JSON.stringify(frontendOrigin)});setTimeout(()=>window.close(),900)}</script></body></html>`;
};

router.post('/oauth/start', jwtAuth, async (req, res) => {
    try {
        if (!['SUPER_ADMIN', 'SEDE_ADMIN', 'LOCAL_ADMIN'].includes(req.user?.role)) {
            return res.status(403).json({ error: 'Only workspace administrators can connect TikTok.' });
        }
        if (!req.tenant?.id || !req.tenant?.slug) {
            return res.status(400).json({ error: 'Select a workspace before connecting TikTok.' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && !req.user.tenants?.includes(req.tenant.slug)) {
            return res.status(403).json({ error: 'You are not authorized to connect TikTok for this workspace.' });
        }
        const authorizationUrl = await tiktokOAuthService.createAuthorizationUrl({
            tenant: req.tenant,
            user: req.user
        });
        return res.json({ authorizationUrl });
    } catch (error) {
        console.error('[TikTok OAuth] Could not start authorization:', error.message);
        return res.status(500).json({ error: error.message });
    }
});

router.get('/oauth/status', jwtAuth, async (req, res) => {
    try {
        if (!req.tenant?.id) return res.status(400).json({ error: 'Workspace not selected.' });
        const status = await tiktokOAuthService.getConnectionStatus(req.tenant.id);
        return res.json(status);
    } catch (error) {
        console.error('[TikTok OAuth] Could not read connection status:', error.message);
        return res.status(500).json({ error: 'Could not read TikTok connection status.' });
    }
});

// TikTok redirects here after the account owner grants or denies authorization.
// This route is public by design; the one-time state value binds it to the tenant
// and administrator that initiated the flow.
router.get('/oauth/callback', async (req, res) => {
    const providerError = req.query.error || req.query.error_description;
    if (providerError) {
        return res.status(400).type('html').send(callbackHtml(false, 'TikTok authorization was declined or could not be completed. Return to the CRM and try again.'));
    }

    const authCode = req.query.auth_code || req.query.code;
    const { state } = req.query;
    if (typeof authCode !== 'string' || !authCode || typeof state !== 'string' || !state) {
        return res.status(400).type('html').send(callbackHtml(false, 'The authorization response was incomplete. Return to the CRM and start the connection again.'));
    }

    try {
        await tiktokOAuthService.completeAuthorization({ state, authCode });
        return res.status(200).type('html').send(callbackHtml(true, 'The authorized TikTok account is now linked to its CRM workspace.'));
    } catch (error) {
        // Never log auth codes, access tokens, refresh tokens, or app secrets.
        console.error('[TikTok OAuth] Callback failed:', error.response?.data?.message || error.message);
        return res.status(400).type('html').send(callbackHtml(false, 'TikTok authorization could not be saved. Return to the CRM and start the connection again.'));
    }
});

module.exports = router;
