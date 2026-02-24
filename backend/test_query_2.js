require('dotenv').config();
const { pool } = require('./src/config/database');
pool.query("SELECT id, whatsapp_id, text_content, sender, timestamp FROM messages ORDER BY timestamp DESC LIMIT 10")
    .then(res => { console.log(res.rows); process.exit(0); });
