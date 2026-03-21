const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { Pool } = require('pg');

const dbUrl = 'postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/producto_clientes_finales_db?sslmode=require';
const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

const BASE_URL = 'https://evolution-api-production-8e62.up.railway.app';
const API_KEY = 'hash_12345';
const INSTANCE = 'large_productosclientesfinales';

async function syncAll() {
    console.log(`🚀 Iniciando extraccion exhaustiva de mensajes desde Evolution API para ${INSTANCE}...`);

    try {
        let currentPage = 1;
        let totalPages = 1;
        let totalImported = 0;

        do {
            console.log(`📡 Solicitando pagina ${currentPage}...`);
            const msgUrl = `${BASE_URL}/chat/findMessages/${INSTANCE}`;
            const msgRes = await fetch(msgUrl, {
                method: 'POST',
                headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    where: {},
                    take: 100, // records per page
                    page: currentPage
                })
            });

            if (!msgRes.ok) {
                console.error(`❌ Error HTTP ${msgRes.status}`);
                break;
            }

            const data = await msgRes.json();
            if (!data.messages) {
                console.log(`⚠️ No se encontraron mensajes en el formato esperado.`);
                break;
            }

            totalPages = data.messages.pages || 1;
            const records = data.messages.records || [];

            if (records.length === 0) break;

            for (const msg of records) {
                await processMessage(msg);
                totalImported++;
            }

            currentPage++;
        } while (currentPage <= totalPages);

        console.log(`✨ Sincronizacion completada! Mensajes guardados: ${totalImported}`);
    } catch (e) {
        console.error('❌ Error fatal:', e.message);
    } finally {
        await pool.end();
    }
}

async function processMessage(msg) {
    const key = msg.key;
    if (!key) return;

    const fromMe = key.fromMe;
    const whatsappId = key.id;
    // Si remoteJidAlt existe (por cuenta vinculada) la usamos, si no remoteJid normal
    const fullJid = key.remoteJidAlt || key.remoteJid;
    if (!fullJid || fullJid.includes('@g.us')) return; // No procesar grupos por el momento si no se desea

    const phone = fullJid.split('@')[0];
    const timestamp = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date();

    let text = '[Mensaje no compatible]';
    let mediaType = null;
    let mediaUrl = null;

    if (msg.message?.conversation) text = msg.message.conversation;
    else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
    else if (msg.message?.imageMessage) {
        text = msg.message.imageMessage.caption || '📷 Imagen';
        mediaType = 'image';
    }
    else if (msg.message?.audioMessage) {
        text = '🎵 Audio';
        mediaType = 'audio';
    } else if (msg.message?.videoMessage) {
        text = msg.message.videoMessage.caption || '🎥 Video';
        mediaType = 'video';
    } else if (msg.message?.documentMessage) {
        text = msg.message.documentMessage.fileName || '📄 Documento';
        mediaType = 'document';
    } else if (msg.messageType === 'reactionMessage' || msg.message?.reactionMessage) {
        return; // Ignorar reacciones para no contar como mensajes principales
    }

    const sender = fromMe ? 'agent' : 'user';
    const contactName = msg.pushName || phone;

    // Insertar Conversacion si no existe
    await pool.query(`
        INSERT INTO conversations (phone, contact_name, ai_enabled, status, updated_at)
        VALUES ($1, $2, true, 'active', NOW())
        ON CONFLICT (phone) DO UPDATE 
        SET contact_name = COALESCE(conversations.contact_name, EXCLUDED.contact_name)
    `, [phone, contactName]);

    // Insertar el Mensaje
    await pool.query(`
        INSERT INTO messages (
            conversation_phone, sender, text_content, whatsapp_id, 
            media_type, media_url, status, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, 'delivered', $7)
        ON CONFLICT (whatsapp_id) DO NOTHING
    `, [phone, sender, text, whatsappId, mediaType, mediaUrl, timestamp]);

    // Actualizar el ultimo mensaje (solo si es mas reciente)
    await pool.query(`
        UPDATE conversations 
        SET last_message_text = $1, last_message_timestamp = $2
        WHERE phone = $3 AND (last_message_timestamp IS NULL OR last_message_timestamp < $2)
    `, [text, timestamp, phone]);
}

syncAll();
