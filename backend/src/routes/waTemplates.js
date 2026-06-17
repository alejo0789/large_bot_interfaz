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

const messageService = require('../services/messageService');
const conversationService = require('../services/conversationService');

const GRAPH_VERSION = 'v19.0';

function normalizePhone(phone) {
    let cleaned = (phone || '').replace(/\D/g, '');
    if (cleaned.length === 10) {
        cleaned = '57' + cleaned;
    }
    return cleaned;
}

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
        wabaId: tenant.wa_business_account_id,
        tenantSlug: tenant.slug
    };
}

// ─── GET /api/wa-templates ────────────────────────────────────────────────────
// Fetch approved templates from Meta Graph API for this tenant's WABA
router.get('/', asyncHandler(async (req, res) => {
    const { token, phoneNumberId, wabaId } = getOfficialConfig();

    if (!wabaId) {
        throw new AppError('No se ha configurado el WhatsApp Business Account ID (WABA ID). Ve a Admin → WhatsApp para agregarlo.', 400);
    }

    // 1. Get Phone Info (optional but good for UI)
    const phoneInfoUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier&access_token=${token}`;
    const phoneRes = await fetch(phoneInfoUrl);
    const phoneData = await phoneRes.json();

    if (!phoneRes.ok) {
        console.error('[waTemplates] Phone info error:', phoneData);
        throw new AppError(`Error consultando número: ${phoneData?.error?.message || 'Token inválido'}`, 400);
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

    // Socket.IO emitter helper
    const io = req.app?.get('io');
    const emitToConversation = (phoneNum, event, data) => {
        if (!io || !tenantSlug) return;
        const dbPhone = normalizePhone(phoneNum);
        const purePhone = phoneNum.replace(/\D/g, '');
        
        // Emit to specific conversation room (tenant-scoped)
        io.to(`tenant:${tenantSlug}:conversation:${purePhone}`).emit(event, data);
        
        // Emit to tenant-specific conversations list room
        io.to(`tenant:${tenantSlug}:conversations:list`).emit('conversation-updated', {
            phone: dbPhone,
            lastMessage: data.message,
            timestamp: data.timestamp || new Date().toISOString(),
            contact_name: data.contact_name,
            unread: 0,
            sender_type: 'agent'
        });
    };

    // Send in batches of 20 with 1s delay between batches to respect rate limits
    const BATCH_SIZE = 20;
    const DELAY_MS = 1000;
    let sent = 0, failed = 0;
    const errors = [];

    for (let i = 0; i < contactList.length; i += BATCH_SIZE) {
        const batch = contactList.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (contact) => {
            const phone = normalizePhone(contact.phone);
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
                    
                    const cleanPhone = normalizePhone(phone);
                    const whatsappId = msgData.messages[0].id;

                    // Reconstruct variables used in body message for local DB preview
                    const varEntries = Object.entries(variables);
                    let textRepresentation = `📋 [Plantilla: ${templateName}]`;
                    if (varEntries.length > 0) {
                        const varList = varEntries.map(([k, v]) => {
                            const isNameVar = ['nombre', 'name', 'contacto'].includes(k.toLowerCase());
                            const val = (isNameVar && contact.name) ? contact.name : v;
                            return `${k}: "${val}"`;
                        }).join(', ');
                        textRepresentation += `\nVariables: { ${varList} }`;
                    }

                    // 1. Ensure conversation exists to avoid foreign key issues
                    const contactName = contact.name || `Usuario ${cleanPhone.slice(-4)}`;
                    await conversationService.upsert(cleanPhone, contactName);

                    // 2. Save message locally
                    const savedMsg = await messageService.create({
                        phone: cleanPhone,
                        sender: 'agent',
                        text: textRepresentation,
                        status: 'sent',
                        whatsappId: whatsappId,
                        timestamp: new Date().toISOString()
                    });

                    // 3. Update last message inside conversation
                    await conversationService.updateLastMessage(cleanPhone, textRepresentation, true);

                    // 4. Emit to frontend
                    emitToConversation(cleanPhone, 'new-message', {
                        id: savedMsg.id,
                        phone: cleanPhone,
                        contact_name: contactName,
                        message: textRepresentation,
                        whatsapp_id: whatsappId,
                        sender_type: 'agent',
                        sender_name: 'Sistema',
                        unread: 0,
                        timestamp: new Date().toISOString()
                    });

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

    // Log stats to DB
    const ctx = tenantContext.getStore();
    if (ctx && ctx.db) {
        try {
            await ctx.db.query(
                'INSERT INTO official_template_stats (template_name, sent_count, failed_count) VALUES ($1, $2, $3)',
                [templateName, sent, failed]
            );
        } catch (dbErr) {
            console.error('Error logging template stats:', dbErr.message);
        }
    }

    res.json({
        success: true,
        total: contactList.length,
        sent,
        failed,
        errors: errors.slice(0, 20) // Return first 20 errors max
    });
}));

// ─── GET /api/wa-templates/stats ─────────────────────────────────────────────
// Get template send statistics for the current month
router.get('/stats', asyncHandler(async (req, res) => {
    const ctx = tenantContext.getStore();
    if (!ctx || !ctx.db) throw new AppError('Sin conexión a base de datos del tenant', 500);

    const { rows } = await ctx.db.query(`
        SELECT COALESCE(SUM(sent_count), 0) as total_sent
        FROM official_template_stats
        WHERE DATE_TRUNC('month', sent_at) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    res.json({
        success: true,
        currentMonthSent: parseInt(rows[0]?.total_sent || 0, 10)
    });
}));

// ─── POST /api/wa-templates/create ────────────────────────────────────────────
// Create a new template in Meta WABA
router.post('/create', asyncHandler(async (req, res) => {
    const { token, wabaId } = getOfficialConfig();
    const { name, category, language = 'es', components } = req.body;

    if (!name || !category || !components || !Array.isArray(components)) {
        throw new AppError('name, category y components (array) son requeridos', 400);
    }

    if (!wabaId) {
        throw new AppError('No se ha configurado el WhatsApp Business Account ID (WABA ID). Ve a Admin → WhatsApp.', 400);
    }

    // Clean name (lowercase, alphanumeric, underscores only)
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const apiUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`;

    const body = {
        name: cleanName,
        category: category.toUpperCase(),
        language,
        components
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('[waTemplates] Template creation error:', data);
        throw new AppError(`Error creando plantilla: ${data?.error?.message || 'Error desconocido'}`, 400);
    }

    res.json({
        success: true,
        template: data
    });
}));

module.exports = router;
