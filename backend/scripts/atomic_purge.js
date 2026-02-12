require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/config/database');

async function purgeAll() {
    try {
        console.log('🔥 INICIANDO PURGA ATÓMICA...');

        const weirdId = '75978642600014';

        // 1. Borrar de la tabla de mensajes
        const res1 = await pool.query('DELETE FROM messages WHERE conversation_phone = $1', [weirdId]);
        console.log(`✅ Mensajes eliminados para ${weirdId}: ${res1.rowCount}`);

        // 2. Borrar cualquier mensaje huérfano de IDs largos (grupos deformados)
        const res2 = await pool.query('DELETE FROM messages WHERE conversation_phone ~ \'^[0-9]+$\' AND length(conversation_phone) > 13');
        console.log(`✅ Mensajes huérfanos eliminados (IDs largos): ${res2.rowCount}`);

        // 3. Borrar de la tabla de conversaciones (por si acaso se recreó)
        const res3 = await pool.query('DELETE FROM conversations WHERE phone = $1 OR (phone ~ \'^[0-9]+$\' AND length(phone) > 13)', [weirdId]);
        console.log(`✅ Conversaciones eliminadas: ${res3.rowCount}`);

        console.log('✨ Purga completada. Recomienda al usuario refrescar el navegador.');

    } catch (e) {
        console.error('❌ Error en purga:', e);
    } finally {
        process.exit();
    }
}

purgeAll();
