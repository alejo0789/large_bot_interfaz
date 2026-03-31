const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/distribuidor_ventas_db?sslmode=require&channel_binding=require',
    ssl: { rejectUnauthorized: false }
});

async function fixLastMessage() {
    console.log('🔧 Actualizando last_message_timestamp en conversaciones...');
    
    const result = await pool.query(`
        UPDATE conversations c
        SET 
            last_message_text = m.text_content,
            last_message_timestamp = m.timestamp
        FROM (
            SELECT DISTINCT ON (conversation_phone)
                conversation_phone,
                text_content,
                timestamp
            FROM messages
            ORDER BY conversation_phone, timestamp DESC
        ) m
        WHERE c.phone = m.conversation_phone
    `);

    console.log(`✅ ${result.rowCount} conversaciones actualizadas con su último mensaje.`);

    // Verify
    const check = await pool.query(
        'SELECT phone, contact_name, last_message_timestamp FROM conversations ORDER BY last_message_timestamp DESC LIMIT 10'
    );
    console.log('\n--- Top 10 conversaciones recientes ---');
    check.rows.forEach(r => {
        console.log(`  - ${r.contact_name || r.phone} | ${r.last_message_timestamp}`);
    });

    await pool.end();
}

fixLastMessage().catch(e => { console.error(e); pool.end(); });
