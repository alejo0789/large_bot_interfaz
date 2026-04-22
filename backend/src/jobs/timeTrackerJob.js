/**
 * Background Time Tracker Job
 * Automatically updates lead classification tags based on time since client's last message.
 * Only applies to Active conversations where last_message_from_me = false.
 */

const { pool } = require('../config/database');

const TIME_THRESHOLDS = [
    { hours: 72, tag: 'LID_3D_PLUS' }, // 3 days
    { hours: 48, tag: 'LID_2D' },      // 2 days
    { hours: 24, tag: 'LID_1D' },      // 1 day
    { hours: 12, tag: 'LID_12H' },     // 12 hours
    { hours: 6,  tag: 'LID_6H' }       // 6 hours
];

async function updateTimeTags() {
    console.log(`⏱️  [Job] Running time tracker for lead classifications across all tenants...`);
    
    let tenants = [];
    const masterClient = await pool.connect();
    try {
        const { rows } = await masterClient.query("SELECT id, slug, db_url FROM tenants");
        tenants = rows;
    } catch (err) {
        console.error('❌ [Job] Error fetching tenants:', err);
        return;
    } finally {
        masterClient.release();
    }

    if (tenants.length === 0) {
        console.log(`⏱️  [Job] No active tenants found. Skipping.`);
        return;
    }

    const { dbManager } = require('../config/database');
    const { tenantContext } = require('../utils/tenantContext');

    for (const tenant of tenants) {
        if (!tenant.db_url) {
            console.warn(`⚠️ [Job] Tenant ${tenant.slug} has no db_url. Skipping.`);
            continue;
        }

        try {
            const tenantPool = await dbManager.getPool(tenant.id, tenant.db_url);
            
            await new Promise((resolve, reject) => {
                tenantContext.run({ tenant, db: tenantPool }, async () => {
                    console.log(`   👉 Processing tenant: ${tenant.slug}`);
                    const client = await tenantPool.connect();
                    try {
                        await client.query('BEGIN');

                        // STEP 1: Clear SLA tags for conversations we already answered
                        const clearResult = await client.query(`
                            UPDATE conversations 
                            SET lead_time = NULL, updated_at = NOW()
                            WHERE status = 'active'
                            AND lead_time IS NOT NULL
                            AND (last_message_from_me = true OR last_message_from_me IS NULL)
                        `);
                        if (clearResult.rowCount > 0) {
                            console.log(`   🧹 Cleared ${clearResult.rowCount} answered conversations in ${tenant.slug}.`);
                        }

                        // STEP 2: Bulk-assign SLA buckets using pure SQL (no per-row loop)
                        // Process thresholds from largest to smallest so each conversation
                        // gets the most specific bucket.
                        let totalUpdated = 0;
                        for (let i = 0; i < TIME_THRESHOLDS.length; i++) {
                            const threshold = TIME_THRESHOLDS[i];
                            const nextThreshold = i > 0 ? TIME_THRESHOLDS[i - 1] : null;

                            let timeCondition;
                            if (nextThreshold) {
                                timeCondition = `
                                    EXTRACT(EPOCH FROM (NOW() - COALESCE(last_message_timestamp, created_at))) / 3600 >= ${threshold.hours}
                                    AND EXTRACT(EPOCH FROM (NOW() - COALESCE(last_message_timestamp, created_at))) / 3600 < ${nextThreshold.hours}
                                `;
                            } else {
                                timeCondition = `
                                    EXTRACT(EPOCH FROM (NOW() - COALESCE(last_message_timestamp, created_at))) / 3600 >= ${threshold.hours}
                                `;
                            }

                            const result = await client.query(`
                                UPDATE conversations 
                                SET lead_time = $1, updated_at = NOW()
                                WHERE status = 'active'
                                AND last_message_from_me = false
                                AND (lead_time IS NULL OR lead_time != $1)
                                AND (${timeCondition})
                                AND NOT EXISTS (
                                    SELECT 1 FROM conversation_tags ct 
                                    JOIN tags t ON ct.tag_id = t.id 
                                    WHERE ct.conversation_phone = phone 
                                    AND t.name ILIKE 'agendar'
                                )
                            `, [threshold.tag]);

                            totalUpdated += result.rowCount;
                        }

                        await client.query('COMMIT');
                        if (totalUpdated > 0) {
                            console.log(`   ✅ Updated SLA tags for ${totalUpdated} conversations in ${tenant.slug}.`);
                        } else {
                            console.log(`   ✓ No changes needed for ${tenant.slug}.`);
                        }
                        resolve();
                    } catch (err) {
                        await client.query('ROLLBACK');
                        reject(err);
                    } finally {
                        client.release();
                    }
                });
            });
            
        } catch (err) {
            console.error(`❌ [Job] Error updating time tracking for tenant ${tenant.slug}:`, err);
        }
    }
}

// Start tracking immediately, then run every 1 hour
function startTimeTrackerJob() {
    console.log('⏰ Starting Time Tracker Job (Runs every 1 hour)');
    
    // Initial run delayed slightly to allow for app spinup
    setTimeout(() => {
        updateTimeTags();
    }, 5000);

    // Re-run every hour
    setInterval(updateTimeTags, 60 * 60 * 1000);
}

module.exports = {
    startTimeTrackerJob,
    updateTimeTags
};
