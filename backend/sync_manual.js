require('dotenv').config();
const { Pool } = require('pg');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { normalizePhone } = require('./src/utils/phoneUtils');

// CONFIG
const TENANT_DB_URL = "postgresql://neondb_owner:npg_LYBzGw64JDWh@ep-withered-term-a4nrhhk1-pooler.us-east-1.aws.neon.tech/ejemplo_medellin?sslmode=require&channel_binding=require";
const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL || 'https://evolution.acertemos.com';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = "large_sedeminutodios";

const pool = new Pool({ connectionString: TENANT_DB_URL });

/** Retorna true si el string parece un código LID (puro número largo) */
function looksLikeLid(str) {
    if (!str) return true;
    const digits = str.replace(/\D/g, '');
    // Si el nombre es básicamente numérico y largo, es un LID, no un nombre real
    return digits.length > 10 && digits.length / str.length > 0.8;
}

async function sync() {
    console.log(`🚀 Iniciando sincronización manual para ${INSTANCE}...`);

    try {
        // 1. Obtener chats de Evolution
        console.log("📋 Obteniendo lista de chats...");
        const chatsRes = await fetch(`${EVOLUTION_BASE_URL}/chat/findChats/${INSTANCE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
            body: JSON.stringify({})
        });

        const chatsData = await chatsRes.json();
        const chats = Array.isArray(chatsData) ? chatsData : (chatsData.chats || chatsData.data || []);

        console.log(`✅ Se encontraron ${chats.length} chats.`);

        // 2. Pre-resolver LIDs via API de Evolution
        console.log("🕵️ Resolviendo LIDs con Evolution API...");
        const lidMap = new Map();
        const lidsToResolve = chats
            .map(c => c.id || c.remoteJid)
            .filter(jid => jid && jid.includes('@lid'));

        if (lidsToResolve.length > 0) {
            console.log(`📡 Enviando ${lidsToResolve.length} LIDs a resolver...`);
            for (let i = 0; i < lidsToResolve.length; i += 50) {
                const chunk = lidsToResolve.slice(i, i + 50);
                try {
                    const res = await fetch(`${EVOLUTION_BASE_URL}/chat/whatsappNumbers/${INSTANCE}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
                        body: JSON.stringify({ numbers: chunk })
                    });
                    const results = await res.json();
                    if (Array.isArray(results)) {
                        for (const r of results) {
                            if (r.exists && r.jid && r.number) {
                                lidMap.set(r.number, r.jid);
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Error en chunk ${i}:`, e.message);
                }
            }
            console.log(`✅ Resueltos ${lidMap.size} LIDs correctamente.`);
        }

        // 3. Procesar cada chat
        for (const chat of chats) {
            const jid = chat.id || chat.remoteJid;

            // Resolver JID real si es un LID
            let targetJid = lidMap.get(jid) || jid;
            let normalizedPhone = normalizePhone(targetJid);

            // Saltamos IDs que no se pueden normalizar a teléfono
            if (!normalizedPhone || normalizedPhone.includes('@lid')) {
                // Aún es un LID, no lo procesamos aún (se intentará por mensajes)
                if (!normalizedPhone) {
                    console.log(`⏩ Saltando ID irreconocible: ${jid}`);
                    continue;
                }
            }

            // Obtener mensajes (antes de insertar, para resolver LIDs por contenido y obtener nombre)
            const msgsRes = await fetch(`${EVOLUTION_BASE_URL}/chat/findMessages/${INSTANCE}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
                body: JSON.stringify({
                    where: { key: { remoteJid: jid } },
                    limit: 50
                })
            });

            const msgsData = await msgsRes.json();
            const messages = Array.isArray(msgsData) ? msgsData : (msgsData.messages?.records || msgsData.records || msgsData.data || []);

            // Si sigue siendo LID, intentar resolver por contenido de mensajes
            if (normalizedPhone.includes('@lid')) {
                let foundPhone = null;
                for (const m of messages) {
                    const txt = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
                    const match = txt.match(/(30|31|32|35)\d{8}/);
                    if (match) {
                        foundPhone = '+57' + match[0];
                        break;
                    }
                }

                if (foundPhone) {
                    console.log(`🔎 LID resuelto por mensajes: ${jid} → ${foundPhone}`);
                    normalizedPhone = foundPhone;
                } else {
                    console.log(`🗑️ Descartando LID irresoluble: ${jid}`);
                    continue;
                }
            }

            // Determinar el mejor nombre disponible:
            // 1. pushName de algún mensaje del usuario (más confiable)
            // 2. Nombre del chat si no parece un LID
            // 3. El número real normalizado como fallback
            let bestName = normalizedPhone; // fallback: usar el propio número

            // Primero buscar pushName en mensajes (el nombre real que WhatsApp conoce)
            for (const m of messages) {
                if (!m.key.fromMe && m.pushName && !m.pushName.includes('@') && !looksLikeLid(m.pushName) && m.pushName.length > 1) {
                    bestName = m.pushName;
                    break;
                }
            }

            // Si no encontramos pushName en msgs, usar el nombre del chat si es válido
            if (bestName === normalizedPhone) {
                const chatName = chat.name || chat.pushName;
                if (chatName && !looksLikeLid(chatName) && chatName.length > 1) {
                    bestName = chatName;
                }
            }

            console.log(`🔍 [${normalizedPhone}] Nombre: "${bestName}" | Msgs: ${messages.length}`);

            // Upsert conversación con nombre correcto
            await pool.query(`
                INSERT INTO conversations (phone, contact_name, status, created_at, updated_at, ai_enabled, conversation_state)
                VALUES ($1, $2, 'active', NOW(), NOW(), false, 'agent_active')
                ON CONFLICT (phone) DO UPDATE SET updated_at = NOW(), contact_name = EXCLUDED.contact_name
            `, [normalizedPhone, bestName]);

            // Guardar mensajes
            for (const msg of messages) {
                const whatsappId = msg.key.id;
                const isFromMe = msg.key.fromMe;
                const sender = isFromMe ? 'agent' : 'user';
                const timestamp = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date();

                let text = '';
                if (msg.message?.conversation) text = msg.message.conversation;
                else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
                else if (msg.message?.imageMessage?.caption) text = msg.message.imageMessage.caption;
                else if (msg.message?.videoMessage?.caption) text = msg.message.videoMessage.caption;

                const dbText = text || (msg.message?.imageMessage ? '📷 Imagen' : (msg.message?.videoMessage ? '🎥 Video' : (msg.message?.audioMessage ? '🎤 Audio' : '📎 Archivo')));

                const senderName = isFromMe ? 'Tú' : (msg.pushName && !looksLikeLid(msg.pushName) ? msg.pushName : bestName);

                await pool.query(`
                    INSERT INTO messages (
                        conversation_phone, sender, text_content, whatsapp_id, timestamp, status, sender_name
                    ) VALUES ($1, $2, $3, $4, $5, 'delivered', $6)
                    ON CONFLICT (whatsapp_id) DO NOTHING
                `, [normalizedPhone, sender, dbText, whatsappId, timestamp, senderName]);
            }

            // Actualizar último mensaje
            if (messages.length > 0) {
                const lastMsg = messages[0];
                let lastText = lastMsg.message?.conversation || lastMsg.message?.extendedTextMessage?.text || 'Archivo';
                await pool.query(
                    "UPDATE conversations SET last_message_text = $1, last_message_timestamp = $2 WHERE phone = $3",
                    [lastText.substring(0, 100), new Date(lastMsg.messageTimestamp * 1000), normalizedPhone]
                );
            }
        }

        console.log("\n✨ Sincronización terminada con éxito.");

    } catch (err) {
        console.error("❌ Error en sync:", err);
    } finally {
        await pool.end();
    }
}

sync();
