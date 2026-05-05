console.log('Current directory:', process.cwd());
console.log('File directory:', __dirname);
const envPath = require('path').join(__dirname, '../.env');
console.log('Loading .env from:', envPath);
require('dotenv').config({ path: envPath });
const { dbManager } = require('../src/config/database');

async function checkTenants() {
    try {
        console.log('--- Checking Tenants Webhooks ---');
        const query = 'SELECT id, name, slug, evolution_instance, n8n_webhook_url FROM tenants';
        const params = [];
        
        const result = await dbManager.masterPool.query(query, params);
        
        if (result.rows.length === 0) {
            console.log('No tenants found matching the criteria.');
        } else {
            console.table(result.rows);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error checking tenants:', error);
        process.exit(1);
    }
}

checkTenants();
