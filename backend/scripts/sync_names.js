const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function syncNames() {
    console.log('🔄 Starting contact name synchronization...');
    const url = `${BASE_URL}/chat/findContacts/${INSTANCE}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "where": {}
            })
        });

        if (!response.ok) {
            console.error(`❌ API Error: ${response.status}`);
            return;
        }

        const chats = await response.json();
        console.log(`✅ Fetched ${chats.length} chats from Evolution API.`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const chat of chats) {
            let jid = chat.remoteJid;
            let altJid = chat.lastMessage?.key?.remoteJidAlt;
            let name = chat.pushName || chat.name || chat.verifiedName;

            if (!name || name.includes('@')) {
                skippedCount++;
                continue;
            }

            // Extract phone number from JID or AltJID
            let phoneToUse = null;

            // Priority: AltJID (usually has the @s.whatsapp.net version)
            if (altJid && altJid.endsWith('@s.whatsapp.net')) {
                const numeric = altJid.split('@')[0].replace(/\D/g, '');
                phoneToUse = numeric.startsWith('57') ? `+${numeric}` : `+${numeric}`; // Standardize
            } else if (jid.endsWith('@s.whatsapp.net')) {
                const numeric = jid.split('@')[0].replace(/\D/g, '');
                phoneToUse = numeric.startsWith('57') ? `+${numeric}` : `+${numeric}`;
            } else if (jid.includes('@g.us')) {
                phoneToUse = jid; // Groups use full JID as ID in our DB
            }

            if (phoneToUse) {
                // Try updating both variants (with and without +) just in case
                const cleanPhoneNoPlus = phoneToUse.replace('+', '');

                try {
                    const res = await pool.query(`
                        UPDATE conversations 
                        SET contact_name = $1, updated_at = NOW()
                        WHERE (phone = $2 OR phone = $3)
                        AND (contact_name IS NULL OR contact_name != $1)
                        RETURNING phone
                    `, [name, phoneToUse, cleanPhoneNoPlus]);

                    if (res.rowCount > 0) {
                        console.log(`✅ Updated: ${phoneToUse} -> ${name}`);
                        updatedCount++;
                    }
                } catch (dbErr) {
                    console.error(`❌ DB Error updating ${phoneToUse}:`, dbErr.message);
                }
            }
        }

        console.log('\n--- Sync Results ---');
        console.log(`Total chats processed: ${chats.length}`);
        console.log(`Names updated: ${updatedCount}`);
        console.log(`Skipped/No change: ${chats.length - updatedCount}`);

    } catch (error) {
        console.error('❌ Sync failed:', error.message);
    } finally {
        await pool.end();
    }
}

syncNames();
