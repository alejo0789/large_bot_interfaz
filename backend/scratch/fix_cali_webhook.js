require('dotenv').config({ path: 'backend/.env' });
const { dbManager } = require('../src/config/database');

async function fixCaliWebhook() {
    try {
        console.log('--- Fixing Cali Webhook ---');
        // Cali has a newline at the end in the DB result we saw earlier
        const query = "UPDATE tenants SET n8n_webhook_url = TRIM(BOTH '\n' FROM n8n_webhook_url) WHERE slug = 'cali' RETURNING n8n_webhook_url";
        const result = await dbManager.masterPool.query(query);
        
        if (result.rows.length > 0) {
            console.log('Cali webhook fixed:', JSON.stringify(result.rows[0].n8n_webhook_url));
        } else {
            console.log('Cali tenant not found.');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error fixing Cali webhook:', error);
        process.exit(1);
    }
}

fixCaliWebhook();
