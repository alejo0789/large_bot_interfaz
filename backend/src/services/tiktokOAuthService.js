const crypto = require('crypto');
const axios = require('axios');
const { dbManager } = require('../config/database');

const API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';
const refreshLocks = new Map();

function requiredEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing ${name} configuration`);
    return value;
}

function encryptionKey() {
    const configured = requiredEnv('TIKTOK_TOKEN_ENCRYPTION_KEY');
    const key = /^[a-f\d]{64}$/i.test(configured)
        ? Buffer.from(configured, 'hex')
        : Buffer.from(configured, 'base64');
    if (key.length !== 32) {
        throw new Error('TIKTOK_TOKEN_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex characters or base64');
    }
    return key;
}

function encryptSecret(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptSecret(value) {
    const [version, ivPart, tagPart, encryptedPart] = String(value || '').split('.');
    if (version !== 'v1' || !ivPart || !tagPart || !encryptedPart) {
        throw new Error('Stored TikTok credential has an invalid format');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(encryptedPart, 'base64url')),
        decipher.final()
    ]).toString('utf8');
}

async function ensureTables() {
    await dbManager.masterPool.query(`
        CREATE TABLE IF NOT EXISTS tiktok_oauth_states (
            state_hash TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            tenant_slug TEXT NOT NULL,
            user_id TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_tiktok_oauth_states_expiry
            ON tiktok_oauth_states (expires_at);

        CREATE TABLE IF NOT EXISTS tiktok_connections (
            tenant_id TEXT PRIMARY KEY,
            tenant_slug TEXT NOT NULL,
            open_id TEXT NOT NULL,
            scopes TEXT[] NOT NULL DEFAULT '{}',
            access_token_encrypted TEXT NOT NULL,
            refresh_token_encrypted TEXT NOT NULL,
            access_token_expires_at TIMESTAMPTZ NOT NULL,
            refresh_token_expires_at TIMESTAMPTZ,
            connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);
}

function hashState(state) {
    return crypto.createHash('sha256').update(state).digest('hex');
}

function getCallbackUrl() {
    const redirectUri = requiredEnv('TIKTOK_REDIRECT_URI');
    const parsed = new URL(redirectUri);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
        throw new Error('TIKTOK_REDIRECT_URI must use HTTPS');
    }
    return redirectUri;
}

async function createAuthorizationUrl({ tenant, user }) {
    await ensureTables();
    // Validate encryption configuration before beginning an authorization flow.
    encryptionKey();

    const authorizationUrl = new URL(requiredEnv('TIKTOK_ACCOUNT_AUTHORIZATION_URL'));
    if (authorizationUrl.protocol !== 'https:' || !/(^|\.)tiktok\.com$/i.test(authorizationUrl.hostname)) {
        throw new Error('TIKTOK_ACCOUNT_AUTHORIZATION_URL must be an HTTPS TikTok URL');
    }
    const redirectUri = getCallbackUrl();
    const configuredRedirect = authorizationUrl.searchParams.get('redirect_uri') || authorizationUrl.searchParams.get('redirect_url');
    if (configuredRedirect && configuredRedirect !== redirectUri) {
        throw new Error('The redirect URL in TIKTOK_ACCOUNT_AUTHORIZATION_URL must exactly match TIKTOK_REDIRECT_URI');
    }

    const state = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await dbManager.masterPool.query(
        `INSERT INTO tiktok_oauth_states (state_hash, tenant_id, tenant_slug, user_id, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [hashState(state), String(tenant.id), tenant.slug, String(user.id), expiresAt]
    );

    authorizationUrl.searchParams.set('state', state);
    return authorizationUrl.toString();
}

async function consumeState(state) {
    if (!state || typeof state !== 'string' || state.length > 256) return null;
    const { rows } = await dbManager.masterPool.query(
        `DELETE FROM tiktok_oauth_states
         WHERE state_hash = $1 AND expires_at > NOW()
         RETURNING tenant_id, tenant_slug, user_id`,
        [hashState(state)]
    );
    return rows[0] || null;
}

async function exchangeCode(authCode) {
    const response = await axios.post(`${API_BASE}/tt_user/oauth2/token/`, {
        client_id: requiredEnv('TIKTOK_APP_ID'),
        client_secret: requiredEnv('TIKTOK_APP_SECRET'),
        grant_type: 'authorization_code',
        auth_code: authCode,
        redirect_uri: getCallbackUrl()
    }, { timeout: 15000 });

    if (response.data?.code !== 0 || !response.data?.data?.access_token || !response.data?.data?.open_id) {
        const message = response.data?.message || 'TikTok did not return a valid account token';
        throw new Error(message);
    }
    return response.data.data;
}

async function completeAuthorization({ state, authCode }) {
    await ensureTables();
    encryptionKey();
    const stateRecord = await consumeState(state);
    if (!stateRecord) throw new Error('Invalid or expired authorization state. Start the connection again.');

    const token = await exchangeCode(authCode);
    const expiresIn = Number(token.expires_in) || 86400;
    const refreshExpiresIn = Number(token.refresh_token_expires_in) || 31536000;
    const scopes = Array.isArray(token.scope)
        ? token.scope
        : String(token.scope || '').split(',').map((scope) => scope.trim()).filter(Boolean);
    if (!token.refresh_token) {
        throw new Error('TikTok did not return a refresh token');
    }

    await dbManager.masterPool.query(
        `INSERT INTO tiktok_connections (
            tenant_id, tenant_slug, open_id, scopes,
            access_token_encrypted, refresh_token_encrypted,
            access_token_expires_at, refresh_token_expires_at, connected_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW() + ($7 * INTERVAL '1 second'),
                   NOW() + ($8 * INTERVAL '1 second'), NOW(), NOW())
         ON CONFLICT (tenant_id) DO UPDATE SET
            tenant_slug = EXCLUDED.tenant_slug,
            open_id = EXCLUDED.open_id,
            scopes = EXCLUDED.scopes,
            access_token_encrypted = EXCLUDED.access_token_encrypted,
            refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
            access_token_expires_at = EXCLUDED.access_token_expires_at,
            refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
            connected_at = NOW(), updated_at = NOW()`,
        [
            stateRecord.tenant_id,
            stateRecord.tenant_slug,
            token.open_id,
            scopes,
            encryptSecret(token.access_token),
            encryptSecret(token.refresh_token),
            expiresIn,
            refreshExpiresIn
        ]
    );

    return { tenantSlug: stateRecord.tenant_slug, openId: token.open_id, scopes };
}

async function refreshConnection(tenantId) {
    if (refreshLocks.has(tenantId)) return refreshLocks.get(tenantId);
    const refreshPromise = (async () => {
        await ensureTables();
        const { rows } = await dbManager.masterPool.query(
            `SELECT * FROM tiktok_connections WHERE tenant_id = $1`, [String(tenantId)]
        );
        const connection = rows[0];
        if (!connection) return null;
        if (new Date(connection.access_token_expires_at).getTime() > Date.now() + 120000) {
            return { accessToken: decryptSecret(connection.access_token_encrypted), openId: connection.open_id };
        }

        const refreshToken = decryptSecret(connection.refresh_token_encrypted);
        const response = await axios.post(`${API_BASE}/tt_user/oauth2/refresh_token/`, {
            client_id: requiredEnv('TIKTOK_APP_ID'),
            client_secret: requiredEnv('TIKTOK_APP_SECRET'),
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        }, { timeout: 15000 });

        const data = response.data?.data;
        if (response.data?.code !== 0 || !data?.access_token || !data?.refresh_token) {
            throw new Error(response.data?.message || 'TikTok access token refresh failed');
        }

        const scopes = Array.isArray(data.scope)
            ? data.scope
            : String(data.scope || connection.scopes.join(',')).split(',').map((scope) => scope.trim()).filter(Boolean);
        const expiresIn = Number(data.expires_in) || 86400;
        const refreshExpiresIn = Number(data.refresh_token_expires_in) || 31536000;
        await dbManager.masterPool.query(
            `UPDATE tiktok_connections SET
                scopes = $2,
                access_token_encrypted = $3,
                refresh_token_encrypted = $4,
                access_token_expires_at = NOW() + ($5 * INTERVAL '1 second'),
                refresh_token_expires_at = NOW() + ($6 * INTERVAL '1 second'),
                updated_at = NOW()
             WHERE tenant_id = $1`,
            [String(tenantId), scopes, encryptSecret(data.access_token), encryptSecret(data.refresh_token), expiresIn, refreshExpiresIn]
        );
        return { accessToken: data.access_token, openId: connection.open_id };
    })();

    refreshLocks.set(tenantId, refreshPromise);
    try {
        return await refreshPromise;
    } finally {
        refreshLocks.delete(tenantId);
    }
}

async function getConnectionStatus(tenantId) {
    await ensureTables();
    const { rows } = await dbManager.masterPool.query(
        `SELECT open_id, scopes, access_token_expires_at, refresh_token_expires_at, connected_at
         FROM tiktok_connections WHERE tenant_id = $1`, [String(tenantId)]
    );
    return rows[0] ? { connected: true, ...rows[0] } : { connected: false };
}

module.exports = {
    createAuthorizationUrl,
    completeAuthorization,
    getConnectionStatus,
    getAccessToken: refreshConnection
};
