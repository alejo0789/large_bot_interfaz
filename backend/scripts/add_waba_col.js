require('dotenv').config();
const { dbManager } = require('../src/config/database');

(async () => {
    console.log('🚀 Iniciando migración de DB para WABA ID...');
    try {
        await dbManager.masterPool.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_business_account_id VARCHAR(255);');
        console.log('✅ Columna wa_business_account_id agregada correctamente (o ya existía).');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error agregando columna:', e);
        process.exit(1);
    }
})();
