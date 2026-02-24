require('dotenv').config();
const { pool } = require('./src/config/database');
const evolutionService = require('./src/services/evolutionService');

async function run() {
    // 1. Get recent message that WE sent to someone
    const { rows } = await pool.query(`
        SELECT * FROM messages 
        WHERE sender = 'agent' AND whatsapp_id IS NOT NULL
        ORDER BY timestamp DESC LIMIT 1
    `);

    if (rows.length === 0) {
        console.log("No messages found");
        process.exit(0);
    }

    const msg = rows[0];
    console.log("Editing message:", msg.whatsapp_id, "to phone:", msg.conversation_phone);
    console.log("Original text:", msg.text_content);

    // 2. Call edit via Evolution Service
    const res = await evolutionService.updateMessage(msg.conversation_phone, msg.whatsapp_id, msg.text_content + " (editado)", true);
    console.log("Response:", JSON.stringify(res, null, 2));
    process.exit(0);
}

run().catch(console.error);
