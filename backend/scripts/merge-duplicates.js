require('dotenv').config();
const { pool } = require('../src/config/database');

function normalizePhone(phone) {
    if (!phone) return phone;
    if (String(phone).includes('@g.us') || String(phone).includes('-')) return String(phone);
    const digits = String(phone).replace(/\D/g, '');
    return digits.length > 0 ? `+${digits}` : String(phone);
}

async function mergeDuplicates() {
    try {
        const { rows } = await pool.query('SELECT phone, unread_count FROM conversations');
        const normalizationMap = new Map();

        for (const row of rows) {
            const normalized = normalizePhone(row.phone);
            if (!normalizationMap.has(normalized)) normalizationMap.set(normalized, []);
            normalizationMap.get(normalized).push(row);
        }

        console.log(`Starting merge process. Found ${rows.length} total rows.`);

        for (const [normalized, originalRows] of normalizationMap.entries()) {
            if (originalRows.length > 1 || (originalRows.length === 1 && originalRows[0].phone !== normalized)) {
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');

                    // 1. Master Check
                    const masterExists = originalRows.some(r => r.phone === normalized);
                    if (!masterExists) {
                        const source = originalRows[0];
                        await client.query(
                            "INSERT INTO conversations (phone, contact_name, status, unread_count, ai_enabled, conversation_state, created_at, updated_at) " +
                            "SELECT CAST($1 AS TEXT), contact_name, status, 0, ai_enabled, conversation_state, created_at, updated_at " +
                            "FROM conversations WHERE phone = CAST($2 AS TEXT)",
                            [normalized, source.phone]
                        );
                    }

                    // 2. Merge Duplicates
                    for (const row of originalRows) {
                        if (row.phone === normalized) continue;

                        await client.query("UPDATE messages SET conversation_phone = CAST($1 AS TEXT) WHERE conversation_phone = CAST($2 AS TEXT)", [normalized, row.phone]);
                        await client.query(
                            "WITH tags_to_move AS (SELECT tag_id, assigned_at FROM conversation_tags WHERE conversation_phone = CAST($2 AS TEXT)) " +
                            "INSERT INTO conversation_tags (conversation_phone, tag_id, assigned_at) " +
                            "SELECT CAST($1 AS TEXT), tag_id, assigned_at FROM tags_to_move " +
                            "ON CONFLICT DO NOTHING",
                            [normalized, row.phone]
                        );
                        await client.query("DELETE FROM conversation_tags WHERE conversation_phone = CAST($1 AS TEXT)", [row.phone]);

                        if (row.unread_count > 0) {
                            await client.query("UPDATE conversations SET unread_count = unread_count + CAST($1 AS INTEGER) WHERE phone = CAST($2 AS TEXT)", [row.unread_count, normalized]);
                        }
                    }

                    // 3. Delete
                    const phonesToDelete = originalRows.map(r => r.phone).filter(p => p !== normalized);
                    if (phonesToDelete.length > 0) {
                        await client.query("DELETE FROM conversations WHERE phone = ANY(CAST($1 AS TEXT[]))", [phonesToDelete]);
                    }

                    await client.query('COMMIT');
                    console.log(`✅ Merged duplicates for ${normalized}`);
                } catch (groupError) {
                    await client.query('ROLLBACK');
                    console.error(`❌ Failed to merge group ${normalized}:`, groupError.message);
                } finally {
                    client.release();
                }
            }
        }

        console.log('--- ALL REMAINING GROUPS PROCESSED ---');
        process.exit(0);
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
}

mergeDuplicates();
