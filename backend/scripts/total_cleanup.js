require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/config/database');

async function absoluteCleanup() {
    try {
        console.log('🚀 Iniciando limpieza absoluta de IDs deformados...');

        // 1. Borrar cualquier conversación que no sea un número de teléfono real (+ o 10-12 dígitos) 
        // ni un JID válido (@g.us).
        // Borramos los que son puramente números pero extremadamente largos.
        const result = await pool.query(`
            DELETE FROM conversations 
            WHERE (phone ~ '^[0-9]+$' AND length(phone) > 13)
               OR phone = '75978642600014'
        `);

        console.log(`✅ Se eliminaron ${result.rowCount} conversaciones basura.`);

        // 2. Ver que quedó
        const remaining = await pool.query('SELECT phone, contact_name FROM conversations LIMIT 5');
        console.log('📋 Conversaciones restantes (ejemplo):');
        remaining.rows.forEach(r => console.log(` - ${r.contact_name}: ${r.phone}`));

    } catch (e) {
        console.error('❌ Error en limpieza:', e);
    } finally {
        process.exit();
    }
}

absoluteCleanup();
