/**
 * Payments Module — Backend Routes
 * Base: /api/payments
 *
 * Endpoints:
 *   POST   /register        ← llamado por n8n al recibir email bancario
 *   POST   /verify          ← llamado por n8n después de procesar imagen del comprobante
 *   GET    /                ← lista paginada con filtros (dashboard admin)
 *   GET    /stats           ← KPIs del dashboard
 *   PATCH  /:id/status      ← verificación/rechazo manual por agente
 */
const express = require('express');
const router = express.Router();
const { tenantContext } = require('../utils/tenantContext');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDb() {
    const ctx = tenantContext.getStore();
    if (!ctx?.db) throw new Error('No tenant DB in context');
    return ctx.db;
}

function normalizePhone(phone) {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) return null;
    // Add Colombia country code if 10-digit local number
    if (digits.length === 10 && digits.startsWith('3')) return '57' + digits;
    return digits;
}

// ─── POST /register ──────────────────────────────────────────────────────────
/**
 * Called by n8n when a bank notification email arrives.
 * Body: { reference, amount, bank, payer_name, payer_account, payment_date, email_subject, raw_email }
 */
router.post('/register', async (req, res) => {
    try {
        const db = getDb();
        const {
            reference,
            amount,
            bank,
            payer_name,
            payer_account,
            payment_date,
            email_subject,
            raw_email
        } = req.body;

        if (!amount && !reference) {
            return res.status(400).json({ error: 'Se requiere al menos amount o reference' });
        }

        // Try to insert; on duplicate (same reference + date) return existing record
        const result = await db.query(
            `INSERT INTO payments
                (reference, amount, bank, payer_name, payer_account, payment_date, email_subject, raw_email, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
             ON CONFLICT (reference, payment_date) WHERE reference IS NOT NULL DO UPDATE
                SET updated_at = NOW(), status = CASE WHEN payments.status = 'pending' THEN 'pending' ELSE payments.status END
             RETURNING *`,
            [reference || null, amount || null, bank || null, payer_name || null,
             payer_account || null, payment_date || null, email_subject || null, raw_email || null]
        );

        const payment = result.rows[0];
        const isDuplicate = payment.updated_at > payment.created_at;

        console.log(`💰 [Payments] Registered: id=${payment.id} ref=${reference} amount=${amount} bank=${bank} duplicate=${isDuplicate}`);

        res.status(isDuplicate ? 200 : 201).json({
            success: true,
            duplicate: isDuplicate,
            payment
        });

    } catch (error) {
        console.error('❌ [Payments] register error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── POST /verify ─────────────────────────────────────────────────────────────
/**
 * Called by n8n after OCR-processing a payment image sent by a client.
 * n8n extracts reference + amount from the image, then calls this endpoint.
 * Body: { reference, amount, conversation_phone, tolerance_pct? }
 */
router.post('/verify', async (req, res) => {
    try {
        const db = getDb();
        const {
            reference,
            amount,
            conversation_phone,
            tolerance_pct = 2   // allow ±2% amount difference by default
        } = req.body;

        if (!amount) {
            return res.status(400).json({ error: 'Se requiere el monto (amount) del comprobante para verificar' });
        }

        const phone = normalizePhone(conversation_phone);
        const toleranceFactor = 1 + (parseFloat(tolerance_pct) / 100);
        const amtNum = parseFloat(amount);

        // Match by amount within tolerance window (last 20 minutes)
        const query = `
            SELECT * FROM payments
            WHERE status = 'pending'
              AND amount BETWEEN $1 AND $2
              AND payment_date >= NOW() - INTERVAL '20 minutes'
            ORDER BY payment_date DESC
            LIMIT 1
        `;
        const params = [amtNum / toleranceFactor, amtNum * toleranceFactor];

        const { rows } = await db.query(query, params);

        if (rows.length === 0) {
            console.log(`⚠️ [Payments] No match found by amount=${amount} in last 20 minutes`);
            return res.json({ matched: false, message: 'No se encontró una notificación de transferencia bancaria por ese valor en las últimas 20 minutos' });
        }

        const payment = rows[0];

        console.log(`🔍 [Payments] Found potential match: id=${payment.id} bank_ref=${payment.reference} amount=${payment.amount} payer=${payment.payer_name}`);

        // Return found payment details. We will let the frontend agent confirm before mutating DB.
        res.json({
            matched: true,
            payment
        });

    } catch (error) {
        console.error('❌ [Payments] verify error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── GET / (list with filters) ────────────────────────────────────────────────
/**
 * Query params: status, bank, startDate, endDate, page, limit
 */
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const {
            status,
            bank,
            startDate,
            endDate,
            page = 1,
            limit = 20
        } = req.query;

        const conditions = [];
        const params = [];

        if (status) {
            params.push(status);
            conditions.push(`status = $${params.length}`);
        }
        if (bank) {
            params.push(`%${bank}%`);
            conditions.push(`bank ILIKE $${params.length}`);
        }
        if (startDate) {
            params.push(startDate);
            conditions.push(`payment_date::date >= $${params.length}`);
        }
        if (endDate) {
            params.push(endDate);
            conditions.push(`payment_date::date <= $${params.length}`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        params.push(parseInt(limit));
        params.push(offset);

        const [dataRes, countRes] = await Promise.all([
            db.query(
                `SELECT p.*,
                        c.contact_name
                 FROM payments p
                 LEFT JOIN conversations c ON c.phone = p.conversation_phone
                 ${where}
                 ORDER BY p.created_at DESC
                 LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            ),
            db.query(
                `SELECT COUNT(*) FROM payments ${where}`,
                params.slice(0, params.length - 2)
            )
        ]);

        res.json({
            payments: dataRes.rows,
            total: parseInt(countRes.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('❌ [Payments] list error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── GET /stats ───────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const db = getDb();
        const { startDate, endDate } = req.query;

        let dateFilter = "payment_date >= CURRENT_DATE";
        const params = [];
        if (startDate && endDate) {
            dateFilter = "payment_date::date >= $1 AND payment_date::date <= $2";
            params.push(startDate, endDate);
        } else if (startDate) {
            dateFilter = "payment_date::date = $1";
            params.push(startDate);
        }

        const { rows } = await db.query(
            `SELECT
                COUNT(*)                                        AS total,
                COUNT(*) FILTER (WHERE status = 'pending')     AS pending,
                COUNT(*) FILTER (WHERE status = 'verified')    AS verified,
                COUNT(*) FILTER (WHERE status = 'rejected')    AS rejected,
                COUNT(*) FILTER (WHERE status = 'duplicate')   AS duplicate,
                COALESCE(SUM(amount), 0)                       AS total_amount,
                COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0) AS verified_amount
             FROM payments
             WHERE ${dateFilter}`,
            params
        );

        const { rows: byBank } = await db.query(
            `SELECT bank, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount
             FROM payments
             WHERE ${dateFilter} AND bank IS NOT NULL
             GROUP BY bank
             ORDER BY amount DESC`,
            params
        );

        const { rows: timeline } = await db.query(
            `SELECT
                date_trunc('day', payment_date) AS day,
                COUNT(*)                        AS count,
                COALESCE(SUM(amount), 0)        AS amount
             FROM payments
             WHERE ${dateFilter}
             GROUP BY day
             ORDER BY day ASC`,
            params
        );

        res.json({
            summary: rows[0],
            byBank,
            timeline
        });

    } catch (error) {
        console.error('❌ [Payments] stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─── PATCH /:id/status ────────────────────────────────────────────────────────
/**
 * Manual verification/rejection by agent.
 * Body: { status: 'verified' | 'rejected' | 'duplicate', notes?, verified_by? }
 */
router.patch('/:id/status', async (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const { status, notes, verified_by } = req.body;

        const allowed = ['verified', 'rejected', 'duplicate', 'pending'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${allowed.join(', ')}` });
        }

        const result = await db.query(
            `UPDATE payments
             SET status = $1::varchar,
                 notes = COALESCE($2, notes),
                 verified_by = COALESCE($3, verified_by),
                 verified_at = CASE WHEN $1::varchar = 'verified' THEN NOW() ELSE verified_at END,
                 updated_at = NOW()
             WHERE id = $4::integer
             RETURNING *`,
            [status, notes || null, verified_by || null, parseInt(id, 10)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }

        console.log(`✏️ [Payments] Status updated: id=${id} → ${status}`);
        res.json({ success: true, payment: result.rows[0] });

        } catch (error) {
            console.error('❌ [Payments] patch status error:', error);
            res.status(500).json({ error: error.message });
        }
});

// ─── POST /trigger-verify ─────────────────────────────────────────────────────
/**
 * Triggers the n8n webhook verification flow for a specific image message.
 * Reads the configured webhook from the tenant settings, calls n8n, and returns the verification result.
 * Body: { messageId }
 */
router.post('/trigger-verify', async (req, res) => {
    try {
        const db = getDb();
        const { messageId } = req.body;

        if (!messageId) {
            return res.status(400).json({ error: 'Se requiere messageId' });
        }

        // 1. Fetch message details from tenant database
        const msgRes = await db.query(
            `SELECT conversation_phone, media_url, media_type
             FROM messages
             WHERE id::text = $1 OR whatsapp_id = $1
             LIMIT 1`,
            [messageId]
        );

        if (msgRes.rows.length === 0) {
            return res.status(404).json({ error: 'Mensaje no encontrado' });
        }

        const message = msgRes.rows[0];
        if (message.media_type !== 'image' || !message.media_url) {
            return res.status(400).json({ error: 'El mensaje debe ser una imagen para verificar el pago' });
        }

        // 2. Fetch the webhook URL from tenant settings
        const settingsRes = await db.query(
            `SELECT value FROM settings WHERE key = 'payment_verify_webhook' LIMIT 1`
        );

        if (settingsRes.rows.length === 0 || !settingsRes.rows[0].value) {
            return res.status(400).json({
                error: 'No se ha configurado un webhook de verificación de pagos para esta sede'
            });
        }

        const webhookUrl = settingsRes.rows[0].value;
        const tenantSlug = req.tenant?.slug || 'unknown';

        console.log(`📤 [Payments] Triggering n8n verification: msg=${messageId} url=${webhookUrl}`);

        // 3. Post payload to n8n webhook
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageUrl: message.media_url,
                conversation_phone: message.conversation_phone,
                phone: message.conversation_phone,
                tenantSlug: tenantSlug,
                messageId: messageId
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`n8n webhook error: ${response.status} - ${errText}`);
        }

        const n8nResult = await response.json().catch(() => ({}));
        console.log(`📥 [Payments] n8n verification response:`, n8nResult);

        res.json({
            success: true,
            n8nResult
        });

    } catch (error) {
        console.error('❌ [Payments] trigger-verify error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
