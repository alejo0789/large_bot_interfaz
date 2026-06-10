require('dotenv').config();
const { Pool } = require('pg');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const TENANT_DB_URL = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/chatbot_db?sslmode=require';
const BASE_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = process.env.EVOLUTION_API_KEY || 'hash_12345';
const INSTANCE = 'large_cali';

const pool = new Pool({
    connectionString: TENANT_DB_URL,
    ssl: { rejectUnauthorized: false }
});

function cleanToPhone(jid) {
    if (!jid) return null;
    let clean = jid.split('@')[0].replace(/\D/g, '');
    if (clean.startsWith('57') && clean.length === 12) {
        return '+' + clean;
    }
    return '+' + clean;
}

async function resolveLidViaEvolution(lidPhone) {
    let rawDigits = lidPhone.replace(/\D/g, '');
    let lidJids = [
        `${rawDigits}@lid`,
        `${rawDigits}@s.whatsapp.net`
    ];

    for (const lidJid of lidJids) {
        try {
            const url = `${BASE_URL}/chat/findMessages/${INSTANCE}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    where: {
                        key: {
                            remoteJid: lidJid
                        }
                    },
                    take: 20
                })
            });

            if (!res.ok) continue;

            const data = await res.json();
            const records = Array.isArray(data) ? data : (data?.messages?.records || data?.records || data?.response?.message?.records || []);

            if (records && records.length > 0) {
                for (const msg of records) {
                    if (msg.key) {
                        const alt = msg.key.remoteJidAlt || msg.key.participantAlt;
                        if (alt && alt.includes('@s.whatsapp.net') && !alt.includes('@lid')) {
                            const resolvedPhone = cleanToPhone(alt);
                            if (resolvedPhone && resolvedPhone !== lidPhone) {
                                return resolvedPhone;
                            }
                        }
                    }
                }
            }
        } catch (err) {
            // Ignore single error
        }
    }
    return null;
}

async function run() {
    console.log(`🚀 Starting optimized targeted LID resolution on instance ${INSTANCE}...`);
    try {
        // 1. Purge empty LID conversations directly (no messages and no tags)
        console.log(`🧹 Purging empty LID duplicates with no messages and no tags...`);
        const purgeRes = await pool.query(`
            DELETE FROM conversations c
            WHERE (c.phone LIKE '%@lid' OR (LENGTH(c.phone) >= 14 AND c.phone NOT LIKE '%@g.us' AND c.phone NOT LIKE '%@broadcast'))
              AND NOT EXISTS (
                  SELECT 1 FROM messages m WHERE m.conversation_phone = c.phone
              )
              AND NOT EXISTS (
                  SELECT 1 FROM conversation_tags t WHERE t.conversation_phone = c.phone
              );
        `);
        console.log(`   🗑️ Deleted ${purgeRes.rowCount} empty duplicate conversations directly.`);

        // 2. Query only the remaining LIDs that DO have messages or tags
        const { rows: lids } = await pool.query(`
            SELECT DISTINCT c.phone, c.contact_name, c.ai_enabled, c.status, c.lead_intent, 
                   c.last_message_text, c.last_message_timestamp
            FROM conversations c
            LEFT JOIN messages m ON c.phone = m.conversation_phone
            LEFT JOIN conversation_tags t ON c.phone = t.conversation_phone
            WHERE (c.phone LIKE '%@lid' OR (LENGTH(c.phone) >= 14 AND c.phone NOT LIKE '%@g.us' AND c.phone NOT LIKE '%@broadcast'))
              AND (m.id IS NOT NULL OR t.tag_id IS NOT NULL)
        `);

        console.log(`Found ${lids.length} LID conversations with messages/tags to resolve & merge.`);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < lids.length; i++) {
            const conv = lids[i];
            const lidPhone = conv.phone;
            console.log(`[${i + 1}/${lids.length}] Resolving ${lidPhone} (${conv.contact_name || 'No Name'})...`);

            const realPhone = await resolveLidViaEvolution(lidPhone);

            if (realPhone) {
                console.log(`   ✅ Resolved to: ${realPhone}. Starting merge...`);
                try {
                    // 1. Ensure real conversation exists
                    await pool.query(`
                        INSERT INTO conversations 
                        (phone, contact_name, ai_enabled, status, lead_intent, last_message_text, last_message_timestamp, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                        ON CONFLICT (phone) DO UPDATE SET
                        contact_name = COALESCE(conversations.contact_name, EXCLUDED.contact_name),
                        last_message_text = COALESCE(conversations.last_message_text, EXCLUDED.last_message_text),
                        last_message_timestamp = COALESCE(conversations.last_message_timestamp, EXCLUDED.last_message_timestamp)
                    `, [
                        realPhone, 
                        conv.contact_name && !conv.contact_name.match(/^\d+$/) ? conv.contact_name : 'Cliente WhatsApp', 
                        conv.ai_enabled, 
                        conv.status, 
                        conv.lead_intent, 
                        conv.last_message_text, 
                        conv.last_message_timestamp
                    ]);

                    // 2. Move messages
                    const msgRes = await pool.query('UPDATE messages SET conversation_phone = $1 WHERE conversation_phone = $2', [realPhone, lidPhone]);
                    console.log(`   Moved ${msgRes.rowCount} messages.`);

                    // 3. Move tags (avoid duplicates)
                    const tagRes = await pool.query(`
                        UPDATE conversation_tags 
                        SET conversation_phone = $1 
                        WHERE conversation_phone = $2 
                        AND NOT EXISTS (
                            SELECT 1 FROM conversation_tags ct2 
                            WHERE ct2.conversation_phone = $1 AND ct2.tag_id = conversation_tags.tag_id
                        )
                    `, [realPhone, lidPhone]);
                    console.log(`   Moved tags: ${tagRes.rowCount}`);

                    // 4. Delete old tags
                    await pool.query('DELETE FROM conversation_tags WHERE conversation_phone = $1', [lidPhone]);

                    // 5. Delete duplicate LID conversation
                    await pool.query('DELETE FROM conversations WHERE phone = $1', [lidPhone]);

                    console.log(`   Successfully merged!`);
                    successCount++;
                } catch (dbErr) {
                    console.error(`   ❌ DB Merge failed for ${lidPhone}:`, dbErr.message);
                    failCount++;
                }
            } else {
                console.log(`   ❌ Could not resolve to a real phone number.`);
                failCount++;
            }
        }

        console.log(`\n🎉 Optimized resolution complete!`);
        console.log(`Successfully merged: ${successCount}`);
        console.log(`Failed to resolve: ${failCount}`);

    } catch (err) {
        console.error('Fatal error:', err);
    } finally {
        await pool.end();
    }
}

run();
