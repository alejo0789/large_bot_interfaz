require('dotenv').config();
const { pool } = require('../src/config/database');

async function markOldAsRead() {
    try {
        console.log('Empezando actualización...');

        const startOfToday = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
        startOfToday.setHours(0, 0, 0, 0);

        // Marcamos todo lo anterior a hoy como leído.
        const result = await pool.query(`
            UPDATE conversations
            SET unread_count = 0, updated_at = NOW()
            WHERE (last_message_timestamp < $1 OR (unread_count > 0 AND last_message_timestamp IS NULL))
              AND unread_count > 0
        `, [startOfToday]);

        console.log(`✅ ¡Se actualizaron ${result.rowCount} conversaciones antiguas como leídas! (Anteriores a ${startOfToday.toISOString()})`);
    } catch (err) {
        console.error('❌ Error ejecutando el script:', err);
    } finally {
        await pool.end();
    }
}

markOldAsRead();
