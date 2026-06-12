/**
 * WhatsApp Official Templates Routes
 * Requires: tenant with whatsapp_provider = 'official' and valid credentials
 *
 * GET  /api/wa-templates          - Fetch all templates from Meta
 * POST /api/wa-bulk-official       - Send bulk messages using an approved template
 */
const express = require('express');
const router = express.Router();
const { tenantContext } = require('../utils/tenantContext');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const GRAPH_VERSION = 'v19.0';

// ─── Helper: get Official API config from tenant context ───────────────────────
function getOfficialConfig() {
    const ctx = tenantContext.getStore();
    const tenant = ctx?.tenant;
    if (!tenant) throw new AppError('Sin contexto de tenant', 401);
    if (tenant.whatsapp_provider !== 'official') {
        throw new AppError('Esta sede no usa la API Oficial de WhatsApp', 400);
    }
    if (!tenant.wa_access_token || !tenant.wa_phone_number_id) {
        throw new AppError('Credenciales de API Oficial no configuradas. Ve a Admin → WhatsApp.', 400);
    }
    return {
        token: tenant.wa_access_token,
        phoneNumberId: tenant.wa_phone_number_id,
        tenantSlug: tenant.slug
    };
}

// ─── GET /api/wa-templates ────────────────────────────────────────────────────
// Fetch approved templates from Meta Graph API for this tenant's WABA
router.get('/', asyncHandler(async (req, res) => {
    const { token, phoneNumberId } = getOfficialConfig();

    // 1. Get the WABA ID from the phone number ID
    const phoneInfoUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier&access_token=${token}`;
    const phoneRes = await fetch(phoneInfoUrl);
    const phoneData = await phoneRes.json();

    if (!phoneRes.ok) {
        console.error('[waTemplates] Phone info error:', phoneData);
        throw new AppError(`Error consultando número: ${phoneData?.error?.message || 'Token inválido'}`, 400);
    }

    // 2. Get WABA ID via the phone number's business account
    const wabaUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}?fields=whatsapp_business_account_id&access_token=${token}`;
    const wabaRes = await fetch(wabaUrl);
    const wabaData = await wabaRes.json();

    let wabaId = wabaData?.whatsapp_business_account_id;

    if (!wabaId) {
        // Fallback: try fetching templates directly using phone number ID in the path
        // Some apps have direct access via /PHONE_NUMBER_ID/message_templates
        const directUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/message_templates?limit=100&access_token=${token}`;
        const directRes = await fetch(directUrl);
        const directData = await directRes.json();
        
        if (directRes.ok && directData.data) {
            return res.json({
                success: true,
                templates: directData.data,
                paging: directData.paging || null,
                source: 'phone_number_direct'
            });
        }

        throw new AppError('No se pudo obtener el WABA ID. Verifica que el token tenga permisos de whatsapp_business_messaging.', 400);
    }

    // 3. Fetch templates from WABA
    const { status = '' } = req.query;
    let url = `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates?limit=100&access_token=${token}`;
    if (status) url += `&status=${status.toUpperCase()}`;

    const tplRes = await fetch(url);
    const tplData = await tplRes.json();

    if (!tplRes.ok) {
        throw new AppError(`Error obteniendo plantillas: ${tplData?.error?.message || 'Error desconocido'}`, 400);
    }

    res.json({
        success: true,
        templates: tplData.data || [],
        paging: tplData.paging || null,
        wabaId,
        phoneInfo: {
            id: phoneData.id,
            displayPhone: phoneData.display_phone_number,
            verifiedName: phoneData.verified_name,
            qualityRating: phoneData.quality_rating
        }
    });
}));

// ─── POST /api/wa-bulk-official ───────────────────────────────────────────────
// Send a template message to a list of contacts
// Body: {
//   templateName: string,
//   templateLanguage: string (e.g. "es_CO"),
//   variables: { [varName]: string },   // static variables for all recipients
//   headerImageUrl?: string,            // if template has image header
//   recipients: [{ phone: string, name?: string }] | tagId | 'all'
//   tagId?: string                      // send to contacts with this tag
// }
router.post('/bulk-send', asyncHandler(async (req, res) => {
    const { token, phoneNumberId, tenantSlug } = getOfficialConfig();
    const {
        templateName,
        templateLanguage,
        variables = {},
        headerImageUrl = null,
        recipients = [],
        tagId = null,
        selectionMode = 'manual'
    } = req.body;

    if (!templateName || !templateLanguage) {
        throw new AppError('templateName y templateLanguage son requeridos', 400);
    }

    // Resolve recipient list
    let contactList = [];

    if (selectionMode === 'tag' && tagId) {
        // Fetch contacts by tag from tenant DB
        const ctx = tenantContext.getStore();
        const db = ctx?.db;
        if (!db) throw new AppError('Sin conexión a base de datos del tenant', 500);

        const { rows } = await db.query(`
            SELECT DISTINCT c.phone, c.contact_name as name
            FROM conversations c
            JOIN conversation_tags ct ON ct.conversation_phone = c.phone
            WHERE ct.tag_id = $1 AND c.phone IS NOT NULL
            ORDER BY c.phone
        `, [tagId]);
        contactList = rows;
    } else if (selectionMode === 'all') {
        const ctx = tenantContext.getStore();
        const db = ctx?.db;
        if (!db) throw new AppError('Sin conexión a base de datos del tenant', 500);

        const { rows } = await db.query(`
            SELECT phone, contact_name as name FROM conversations
            WHERE phone IS NOT NULL AND status = 'active'
            ORDER BY phone
        `);
        contactList = rows;
    } else {
        // Manual list
        contactList = Array.isArray(recipients)
            ? recipients.map(r => typeof r === 'string' ? { phone: r, name: '' } : r)
            : [];
    }

    if (contactList.length === 0) {
        throw new AppError('No hay destinatarios seleccionados', 400);
    }

    const apiUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;

    // Build component list for template
    const buildComponents = (contact) => {
        const comps = [];

        // Header (image)
        if (headerImageUrl) {
            comps.push({
                type: 'header',
                parameters: [{ type: 'image', image: { link: headerImageUrl } }]
            });
        }

        // Body variables — replace {{nombre}} with contact name if present
        const bodyParams = Object.entries(variables).map(([key, value]) => {
            // Auto-replace {{nombre}} or {{name}} with contact name
            const isNameVar = ['nombre', 'name', 'contacto'].includes(key.toLowerCase());
            return {
                type: 'text',
                text: (isNameVar && contact.name) ? contact.name : value
            };
        });

        if (bodyParams.length > 0) {
            comps.push({ type: 'body', parameters: bodyParams });
        }

        return comps;
    };

    // Send in batches of 20 with 1s delay between batches to respect rate limits
    const BATCH_SIZE = 20;
    const DELAY_MS = 1000;
    let sent = 0, failed = 0;
    const errors = [];

    for (let i = 0; i < contactList.length; i += BATCH_SIZE) {
        const batch = contactList.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (contact) => {
            const phone = (contact.phone || '').replace(/\D/g, '');
            if (!phone) { failed++; return; }

            const body = {
                messaging_product: 'whatsapp',
                to: phone,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: templateLanguage },
                    components: buildComponents(contact)
                }
            };

            try {
                const msgRes = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });
                const msgData = await msgRes.json();
                if (msgRes.ok && msgData.messages?.[0]?.id) {
                    sent++;
                } else {
                    failed++;
                    errors.push({ phone, error: msgData?.error?.message || 'Error desconocido' });
                }
            } catch (err) {
                failed++;
                errors.push({ phone, error: err.message });
            }
        }));

        if (i + BATCH_SIZE < contactList.length) {
            await new Promise(r => setTimeout(r, DELAY_MS));
        }
    }

    console.log(`📊 [WA Bulk Official] Tenant: ${tenantSlug} | Template: ${templateName} | Sent: ${sent} | Failed: ${failed}`);

    res.json({
        success: true,
        total: contactList.length,
        sent,
        failed,
        errors: errors.slice(0, 20) // Return first 20 errors max
    });
}));

module.exports = router;
