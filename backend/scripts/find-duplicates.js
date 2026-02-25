require('dotenv').config();
const { pool } = require('../src/config/database');

function normalize(phone) {
    return String(phone).replace(/\D/g, '');
}

async function checkDuplicates() {
    try {
        const { rows } = await pool.query('SELECT phone, contact_name FROM conversations');
        const map = new Map();

        const duplicates = [];
        for (const row of rows) {
            const pure = normalize(row.phone);
            if (map.has(pure)) {
                duplicates.push({
                    pure,
                    original1: map.get(pure),
                    original2: row.phone
                });
            } else {
                map.set(pure, row.phone);
            }
        }

        console.log('--- GLOBAL DUPLICATE DETECTION (NEON) ---');
        console.log(`Total conversations: ${rows.length}`);
        if (duplicates.length === 0) {
            console.log('No duplicates found using digit-only normalization.');
        } else {
            console.log(`Found ${duplicates.length} probable duplicates:`);
            duplicates.forEach(d => console.log(`  - Digit-only ID: ${d.pure} | Forms: "${d.original1}" vs "${d.original2}"`));
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkDuplicates();
