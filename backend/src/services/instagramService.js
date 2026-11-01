const crypto = require('crypto');
const axios = require('axios');
const { dbManager } = require('../config/database');

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || process.env.WHATSAPP_GRAPH_API_VERSION || 'v22.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function required(name) {
    if (!process.env[name]) throw new Error(`Missing ${name} configuration`);
    return process.env[name];
}

function encryptionKey() {
    const raw = required('META_TOKEN_ENCRYPTION_KEY');
    const key = /^[a-f\d]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('META_TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as hex or base64');
    return key;
}

function encrypt(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function decrypt(value) {
    const [version, iv, tag, data] = String(value).split('.');
    if (version !== 'v1' || !iv || !tag || !data) throw new Error('Stored Instagram credential has invalid format');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

async function ensureTables() {
    await dbManager.masterPool.query(`
        CREATE TABLE IF NOT EXISTS instagram_oauth_states (
            state_hash TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, tenant_slug TEXT NOT NULL,
            user_id TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_instagram_oauth_states_expiry ON instagram_oauth_states (expires_at);
        CREATE TABLE IF NOT EXISTS instagram_connections (
            tenant_id TEXT PRIMARY KEY, tenant_slug TEXT NOT NULL, page_id TEXT,
            page_name TEXT, instagram_user_id TEXT NOT NULL, instagram_webhook_id TEXT, instagram_username TEXT,
            access_token_encrypted TEXT NOT NULL, scopes TEXT[] NOT NULL DEFAULT '{}',
            token_expires_at TIMESTAMPTZ, connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE instagram_connections ALTER COLUMN page_id DROP NOT NULL;
        ALTER TABLE instagram_connections ADD COLUMN IF NOT EXISTS instagram_webhook_id TEXT;
    `);
}

function callbackUrl() {
    const value = required('INSTAGRAM_REDIRECT_URI');
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error('INSTAGRAM_REDIRECT_URI must use HTTPS');
    return value;
}

function authorizationUrl(state) {
    const parsed = new URL(required('INSTAGRAM_LOGIN_URL'));
    if (parsed.protocol !== 'https:' || !['facebook.com', 'www.facebook.com'].includes(parsed.hostname)) {
        throw new Error('INSTAGRAM_LOGIN_URL must be the Facebook Login URL generated in Meta Developers');
    }
    if (parsed.searchParams.get('client_id') !== required('META_APP_ID')) throw new Error('The client_id in INSTAGRAM_LOGIN_URL must match META_APP_ID');
    if (parsed.searchParams.get('redirect_uri') !== callbackUrl()) throw new Error('The redirect_uri in INSTAGRAM_LOGIN_URL must exactly match INSTAGRAM_REDIRECT_URI');
    parsed.searchParams.set('state', state);
    return parsed.toString();
}

const hashState = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function createAuthorizationUrl({ tenant, user }) {
    await ensureTables();
    encryptionKey();
    const state = crypto.randomBytes(32).toString('base64url');
    const url = authorizationUrl(state);
    await dbManager.masterPool.query(
        'INSERT INTO instagram_oauth_states (state_hash, tenant_id, tenant_slug, user_id, expires_at) VALUES ($1,$2,$3,$4,NOW() + INTERVAL \'10 minutes\')',
        [hashState(state), String(tenant.id), tenant.slug, String(user.id)]
    );
    return url;
}

async function consumeState(state) {
    if (typeof state !== 'string' || state.length > 256) return null;
    const { rows } = await dbManager.masterPool.query(
        'DELETE FROM instagram_oauth_states WHERE state_hash = $1 AND expires_at > NOW() RETURNING tenant_id, tenant_slug, user_id',
        [hashState(state)]
    );
    return rows[0] || null;
}

async function graphGet(path, params) {
    try {
        const { data } = await axios.get(`${GRAPH_BASE}/${path}`, { params, timeout: 20000 });
        if (data.error) {
            const error = data.error;
            throw new Error(`${error.message || 'Meta Graph API request failed'}${error.code ? ` (Meta ${error.code}${error.error_subcode ? `/${error.error_subcode}` : ''})` : ''}`);
        }
        return data;
    } catch (error) {
        if (error.response?.data?.error) {
            const metaError = error.response.data.error;
            throw new Error(`${metaError.message || error.message}${metaError.code ? ` (Meta ${metaError.code}${metaError.error_subcode ? `/${metaError.error_subcode}` : ''})` : ''}`);
        }
        throw error;
    }
}

async function completeAuthorization({ state, code }) {
    await ensureTables();
    encryptionKey();
    const stateRecord = await consumeState(state);
    if (!stateRecord) throw new Error('Invalid or expired authorization state. Start again from CRM.');

    const tokenResponse = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
        params: {
            client_id: required('META_APP_ID'), client_secret: required('META_APP_SECRET'),
            redirect_uri: callbackUrl(), code
        }, timeout: 20000
    });
    const shortToken = tokenResponse.data?.access_token;
    if (!shortToken) throw new Error('Meta did not return an access token');

    const accessToken = shortToken;
    const expiresIn = Number(tokenResponse.data.expires_in) || null;

    // Unified Login returns a business integration system-user token. Its
    // instagram permission target_ids identify the granted Instagram assets.
    const candidates = new Set();
    const discoveryErrors = [];
    let systemUserId = tokenResponse.data.user_id ? String(tokenResponse.data.user_id) : null;
    for (const scope of tokenResponse.data.granular_scopes || []) {
        if (scope.scope && !String(scope.scope).startsWith('instagram_')) continue;
        for (const id of scope.target_ids || []) candidates.add(String(id));
    }
    try {
        const debug = await graphGet('debug_token', {
            input_token: accessToken,
            access_token: `${required('META_APP_ID')}|${required('META_APP_SECRET')}`
        });
        console.info('[Instagram OAuth] Safe token grant metadata:', JSON.stringify({
            type: debug.data?.type || null,
            user_id: debug.data?.user_id || null,
            profile_id: debug.data?.profile_id || null,
            client_business_id: debug.data?.client_business_id || null,
            scopes: debug.data?.scopes || [],
            granular_scopes: (debug.data?.granular_scopes || []).map(({ scope, target_ids }) => ({ scope, target_ids: target_ids || [] }))
        }));
        if (!systemUserId && debug.data?.user_id) systemUserId = String(debug.data.user_id);
        for (const scope of debug.data?.granular_scopes || []) {
            if (scope.scope && !String(scope.scope).startsWith('instagram_')) continue;
            for (const id of scope.target_ids || []) candidates.add(String(id));
        }
    } catch (error) {
        discoveryErrors.push(`token grant inspection: ${error.message}`);
        console.warn('[Instagram OAuth] Could not inspect granted Instagram assets:', error.message);
    }

    // Business Integration System User tokens have a system-user ID, not an
    // Instagram ID. Resolve the linked business portfolio through the user node.
    let clientBusinessId = null;
    try {
        if (systemUserId) {
            const subject = await graphGet(systemUserId, {
                fields: 'id,name,client_business_id', access_token: accessToken
            });
            clientBusinessId = subject.client_business_id ? String(subject.client_business_id) : null;
            console.info('[Instagram OAuth] Unified Login token subject:', JSON.stringify({
                id: subject.id || systemUserId,
                name: subject.name || null,
                client_business_id: clientBusinessId
            }));
        }
    } catch (error) {
        discoveryErrors.push(`system user business lookup: ${error.message}`);
        console.warn('[Instagram OAuth] Could not resolve system-user business:', error.message);
    }

    let instagramAccount = null;
    let linkedPage = null;
    for (const id of candidates) {
        try {
            const profile = await graphGet(id, {
                fields: 'id,username,ig_id,legacy_instagram_user_id', access_token: accessToken
            });
            if (profile.id) {
                const webhookId = profile.legacy_instagram_user_id || profile.ig_id;
                instagramAccount = { ...profile, webhookId: webhookId ? String(webhookId) : null };
                break;
            }
        } catch (error) {
            discoveryErrors.push(`asset ${id}: ${error.message}`);
        }
    }

    if (!instagramAccount && clientBusinessId) {
        const businessAccounts = new Map();
        // These are Business Graph API edges. `client_instagram_accounts` is
        // not a valid edge; the Business API names the shared-asset edge
        // `client_instagram_assets`.
        for (const edge of ['owned_instagram_accounts', 'client_instagram_assets', 'instagram_accounts', 'instagram_business_accounts']) {
            try {
                const result = await graphGet(`${clientBusinessId}/${edge}`, {
                    fields: edge === 'client_instagram_assets'
                        ? 'id,ig_user_id,ig_username'
                        : 'id,username,name',
                    limit: 100,
                    access_token: accessToken
                });
                for (const account of result.data || []) {
                    // InstagramBusinessAsset.id identifies the asset wrapper;
                    // its ig_user_id is the actual IG account ID used by
                    // Instagram webhooks. The other edges return IGUser nodes.
                    const instagramId = edge === 'client_instagram_assets'
                        ? account.ig_user_id
                        : account.id;
                    if (instagramId) {
                        businessAccounts.set(String(instagramId), {
                            ...account,
                            id: String(instagramId),
                            username: edge === 'client_instagram_assets'
                                ? account.ig_username || null
                                : account.username || null
                        });
                    }
                }
            } catch (error) {
                discoveryErrors.push(`${edge}: ${error.message}`);
            }
        }
        if (businessAccounts.size === 1) instagramAccount = [...businessAccounts.values()][0];
        else if (businessAccounts.size > 1) {
            throw new Error('La autorización devolvió varias cuentas de Instagram. Ajusta la configuración Unified Login para conceder solo la cuenta que deseas conectar.');
        }
    }

    if (!instagramAccount) {
        const grantedInstagramScopes = (tokenResponse.data.granted_scopes || '').toString();
        const diagnostics = [
            `IDs de activos concedidos: ${candidates.size}`,
            `Permisos concedidos: ${grantedInstagramScopes || 'no incluidos en la respuesta OAuth'}`,
            discoveryErrors.length ? `Errores consultando activos: ${discoveryErrors.join(' | ').slice(0, 500)}` : ''
        ].filter(Boolean).join('. ');
        throw new Error(`Meta autorizó la app, pero no entregó un ID de cuenta de Instagram que el backend pueda usar. ${diagnostics}. Revisa el log seguro "Safe token grant metadata" para confirmar si instagram_basic trae target_ids.`);
    }

    // Keep the Graph object ID for API calls and the Instagram ig_id used by
    // webhook entry.id for routing; Meta can expose these as different IDs.
    if (!instagramAccount.webhookId) {
        try {
            const profile = await graphGet(instagramAccount.id, {
                fields: 'id,username,ig_id,legacy_instagram_user_id', access_token: accessToken
            });
            const webhookId = profile.legacy_instagram_user_id || profile.ig_id;
            instagramAccount.webhookId = webhookId ? String(webhookId) : null;
            instagramAccount.username = instagramAccount.username || profile.username || null;
        } catch (error) {
            discoveryErrors.push(`Instagram webhook ID lookup: ${error.message}`);
            console.warn('[Instagram OAuth] Could not resolve Instagram webhook ID:', error.message);
        }
    }
    try {
        const profileIds = await graphGet(instagramAccount.id, {
            fields: 'user_id', access_token: accessToken
        });
        if (profileIds.user_id) instagramAccount.webhookId = String(profileIds.user_id);
    } catch (error) {
        console.info('[Instagram OAuth] Instagram API user_id is unavailable for this token; using the profile ID alias if present.');
    }
    console.info('[Instagram OAuth] Resolved account IDs:', JSON.stringify({
        username: instagramAccount.username || instagramAccount.name || null,
        graph_id: String(instagramAccount.id),
        webhook_ig_id: instagramAccount.webhookId || null
    }));

    const scopes = tokenResponse.data.granted_scopes
        ? String(tokenResponse.data.granted_scopes).split(',')
        : ['instagram_basic', 'instagram_manage_messages'];
    await dbManager.masterPool.query(`
        INSERT INTO instagram_connections (
            tenant_id, tenant_slug, page_id, page_name, instagram_user_id, instagram_webhook_id, instagram_username,
            access_token_encrypted, scopes, token_expires_at, connected_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW() + ($10 * INTERVAL '1 second'),NOW(),NOW())
        ON CONFLICT (tenant_id) DO UPDATE SET tenant_slug=EXCLUDED.tenant_slug,
            page_id=EXCLUDED.page_id, page_name=EXCLUDED.page_name,
            instagram_user_id=EXCLUDED.instagram_user_id, instagram_webhook_id=EXCLUDED.instagram_webhook_id,
            instagram_username=EXCLUDED.instagram_username,
            access_token_encrypted=EXCLUDED.access_token_encrypted, scopes=EXCLUDED.scopes,
            token_expires_at=EXCLUDED.token_expires_at, connected_at=NOW(), updated_at=NOW()
    `, [String(stateRecord.tenant_id), stateRecord.tenant_slug, linkedPage?.id || null, linkedPage?.name || null,
        String(instagramAccount.id), instagramAccount.webhookId, instagramAccount.username || instagramAccount.name || null,
        encrypt(linkedPage?.access_token || accessToken), scopes, expiresIn]);
    return { tenantSlug: stateRecord.tenant_slug, instagramUserId: String(instagramAccount.id), username: instagramAccount.username || null };
}

async function getConnectionStatus(tenantId) {
    await ensureTables();
    const { rows } = await dbManager.masterPool.query(`
        SELECT page_id, page_name, instagram_user_id, instagram_webhook_id, instagram_username, scopes, token_expires_at, connected_at
        FROM instagram_connections WHERE tenant_id = $1
    `, [String(tenantId)]);
    return rows[0] ? { connected: true, ...rows[0] } : { connected: false };
}

async function getConnectionByInstagramId(id) {
    await ensureTables();
    const { rows } = await dbManager.masterPool.query('SELECT * FROM instagram_connections WHERE instagram_user_id=$1 OR instagram_webhook_id=$1 OR page_id=$1 LIMIT 1', [String(id)]);
    if (!rows[0]) return null;
    return { ...rows[0], accessToken: decrypt(rows[0].access_token_encrypted) };
}

async function getConnectionForTenant(tenantId) {
    await ensureTables();
    const { rows } = await dbManager.masterPool.query('SELECT * FROM instagram_connections WHERE tenant_id=$1', [String(tenantId)]);
    if (!rows[0]) throw new Error('No Instagram account is connected to this workspace.');
    return { ...rows[0], accessToken: decrypt(rows[0].access_token_encrypted) };
}

async function sendMessage(phone, text) {
    const match = /^instagram_(.+)$/.exec(String(phone));
    if (!match || !text) throw new Error('Instagram conversation or message is invalid.');
    const { tenantContext } = require('../utils/tenantContext');
    const tenant = tenantContext.getStore()?.tenant;
    if (!tenant?.id) throw new Error('Workspace context is missing.');
    const connection = await getConnectionForTenant(tenant.id);
    const { data } = await axios.post(`${GRAPH_BASE}/${connection.instagram_user_id}/messages`, {
        recipient: { id: match[1] }, message: { text }
    }, { params: { access_token: connection.accessToken }, timeout: 20000 });
    if (data.error) throw new Error(data.error.message || 'Instagram message could not be sent');
    return { success: true, messageId: data.message_id || null, recipientId: data.recipient_id || match[1], data };
}

function verifyWebhookSignature(rawBody, signature) {
    if (!rawBody || !signature || !process.env.META_APP_SECRET) return false;
    const expected = `sha256=${crypto.createHmac('sha256', process.env.META_APP_SECRET).update(rawBody).digest('hex')}`;
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { createAuthorizationUrl, completeAuthorization, getConnectionStatus, getConnectionByInstagramId, sendMessage, verifyWebhookSignature };
