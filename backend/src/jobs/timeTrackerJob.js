/**
 * Background Time Tracker Job
 * Automatically updates lead classification tags recursively based on time since their last message.
 * Only applies to Active conversations.
 */

const { pool } = require('../config/database');

const TIME_TAGS = ['LID_6H', 'LID_12H', 'LID_1D', 'LID_2D', 'LID_3D_PLUS'];

// Maps hour threshold to tag name
const TIME_THRESHOLDS = [
    { hours: 72, tag: 'LID_3D_PLUS' }, // 3 days
    { hours: 48, tag: 'LID_2D' },      // 2 days
    { hours: 24, tag: 'LID_1D' },      // 1 day
    { hours: 12, tag: 'LID_12H' },     // 12 hours
    { hours: 6, tag: 'LID_6H' }        // 6 hours
];

async function updateTimeTags() {
    console.log(`⏱️  [Job] Running time tracker for lead classifications across all tenants...`);
    
    // First, get all tenants from the master DB
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

    // Now loop through each tenant and update their respective lead_time columns
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

                        // Find all active conversations and their hours since the last message
                        const { rows: conversations } = await client.query(`
                            SELECT 
                                c.phone,
                                c.lead_time,
                                EXTRACT(EPOCH FROM (NOW() - COALESCE(c.last_message_timestamp, c.created_at))) / 3600 AS hours_since
                            FROM conversations c
                            WHERE c.status = 'active'
                            AND NOT EXISTS (
                                SELECT 1 FROM conversation_tags ct 
                                JOIN tags t ON ct.tag_id = t.id 
                                WHERE ct.conversation_phone = c.phone 
                                AND t.name ILIKE 'agendar'
                            )
                        `);

                        let updatedCount = 0;

                        for (const conv of conversations) {
                            let targetTag = null;

                            for (const threshold of TIME_THRESHOLDS) {
                                if (conv.hours_since >= threshold.hours) {
                                    targetTag = threshold.tag;
                                    break;
                                }
                            }

                            // If we have a new classification or it changed, update the column directly
                            if (targetTag && conv.lead_time !== targetTag) {
                                await client.query(`
                                    UPDATE conversations 
                                    SET lead_time = $1, updated_at = NOW()
                                    WHERE phone = $2
                                `, [targetTag, conv.phone]);
                                
                                updatedCount++;
                            }
                        }

                        await client.query('COMMIT');
                        if (updatedCount > 0) {
                            console.log(`   ✅ Updated lead_time for ${updatedCount} conversations in ${tenant.slug}.`);
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

// Start tracking immediately to catch up, then run every 1 hour
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
