require('dotenv').config();
const { Pool } = require('pg');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";
const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = "large_sedeminutodios";

const pool = new Pool({ connectionString: TENANT_DB_URL });

const looksLikeLid = (str) => {
    if (!str) return true;
    const digits = str.replace(/\D/g, '');
    return digits.length > 10 && (digits.length / str.length) > 0.8;
};

/**
 * Sincroniza un número específico por su JID directamente
 */
async function syncSingleNumber(jid) {
    const phone = '+' + jid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    console.log(`\n🔍 Sincronizando: ${jid} → ${phone}`);

    const msgsRes = await fetch(`${EVOLUTION_BASE_URL}/chat/findMessages/${INSTANCE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
        body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 100 })
    });

    const msgsData = await msgsRes.json();
    const messages = Array.isArray(msgsData) ? msgsData : (msgsData.messages?.records || msgsData.records || msgsData.data || []);
    console.log(`📥 Mensajes encontrados: ${messages.length}`);

    if (messages.length === 0) {
        console.log('❌ Sin mensajes, saltando.');
        return;
    }

    // Encontrar el mejor nombre (pushName del usuario)
    let bestName = phone;
    for (const m of messages) {
        if (!m.key.fromMe && m.pushName && !m.pushName.includes('@') && !looksLikeLid(m.pushName) && m.pushName.length > 1) {
            bestName = m.pushName;
            break;
        }
    }

    console.log(`👤 Nombre: "${bestName}"`);

    // Crear/actualizar conversación
    await pool.query(`
        INSERT INTO conversations (phone, contact_name, status, created_at, updated_at, ai_enabled, conversation_state)
        VALUES ($1, $2, 'active', NOW(), NOW(), false, 'agent_active')
        ON CONFLICT (phone) DO UPDATE SET updated_at = NOW(), contact_name = EXCLUDED.contact_name
    `, [phone, bestName]);

    // Guardar mensajes
    let saved = 0;
    for (const msg of messages) {
        const isFromMe = msg.key.fromMe;
        let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '';
        const dbText = text || (msg.message?.imageMessage ? '📷 Imagen' : (msg.message?.videoMessage ? '🎥 Video' : (msg.message?.audioMessage ? '🎤 Audio' : '📎 Archivo')));
        const senderName = isFromMe ? 'Tú' : ((!looksLikeLid(msg.pushName) ? msg.pushName : null) || bestName);
        const timestamp = new Date(msg.messageTimestamp * 1000);

        const r = await pool.query(`
            INSERT INTO messages (conversation_phone, sender, text_content, whatsapp_id, timestamp, status, sender_name)
            VALUES ($1, $2, $3, $4, $5, 'delivered', $6)
            ON CONFLICT (whatsapp_id) DO NOTHING
        `, [phone, isFromMe ? 'agent' : 'user', dbText, msg.key.id, timestamp, senderName]);
        if (r.rowCount > 0) saved++;
    }

    // Actualizar último mensaje
    if (messages.length > 0) {
        const lastMsg = messages[0];
        const lastText = lastMsg.message?.conversation || lastMsg.message?.extendedTextMessage?.text || 'Archivo';
        await pool.query(
            "UPDATE conversations SET last_message_text = $1, last_message_timestamp = $2 WHERE phone = $3",
            [lastText.substring(0, 100), new Date(lastMsg.messageTimestamp * 1000), phone]
        );
    }

    console.log(`✅ Guardados ${saved} mensajes nuevos para ${phone}.`);
}

// Lista de números a sincronizar manualmente
const NUMBERS = [
    '573192569425@s.whatsapp.net', // Ejemplo reportado por el usuario
];

async function main() {
    for (const jid of NUMBERS) {
        await syncSingleNumber(jid);
    }
    await pool.end();
    console.log('\n✨ Listo.');
}
main().catch(console.error);
