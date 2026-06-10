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
    // Determine the raw JID
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
            console.error(`Error querying messages for ${lidJid}:`, err.message);
        }
    }
    return null;
}

async function run() {
    console.log(`🚀 Starting targeted LID resolution on instance ${INSTANCE}...`);
    try {
        // Query LID candidates
        const { rows: lids } = await pool.query(`
            SELECT phone, contact_name, ai_enabled, status, lead_intent, 
                   last_message_text, last_message_timestamp
            FROM conversations
            WHERE phone LIKE '%@lid' OR (LENGTH(phone) >= 14 AND phone NOT LIKE '%@g.us' AND phone NOT LIKE '%@broadcast')
        `);

        console.log(`Found ${lids.length} potential LID/long-number duplicate conversations in DB.`);

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
                    await pool.query(`
                        UPDATE conversation_tags 
                        SET conversation_phone = $1 
                        WHERE conversation_phone = $2 
                        AND NOT EXISTS (
                            SELECT 1 FROM conversation_tags ct2 
                            WHERE ct2.conversation_phone = $1 AND ct2.tag_id = conversation_tags.tag_id
                        )
                    `, [realPhone, lidPhone]);

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

        console.log(`\n🎉 Targeted resolution complete!`);
        console.log(`Successfully merged: ${successCount}`);
        console.log(`Failed to resolve: ${failCount}`);

    } catch (err) {
        console.error('Fatal error:', err);
    } finally {
        await pool.end();
    }
}

run();
