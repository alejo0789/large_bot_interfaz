require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.MASTER_DATABASE_URL });
pool.query('SELECT slug, whatsapp_provider, wa_verify_token FROM tenants')
    .then(r => { console.log(r.rows); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
