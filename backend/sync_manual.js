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

        for (const chat of chats) {
            const jid = chat.id || chat.remoteJid;
            const name = chat.name || chat.pushName || jid.split('@')[0];
            const normalizedPhone = normalizePhone(jid);

            // Si el normalizePhone no pudo sacar un número real de Colombia (10-12 dígitos)
            // y sigue siendo un LID largo, lo saltamos para evitar basura en la lista
            if (jid.includes('@lid') && normalizedPhone.length > 13) {
                console.log(`⏩ Saltando LID no resuelto: ${jid}`);
                continue;
            }

            if (!normalizedPhone) {
                continue;
            }

            console.log(`\n🔍 Procesando chat: ${name} (${normalizedPhone})`);

            // Upsert conversación
            await pool.query(`
                INSERT INTO conversations (phone, contact_name, status, created_at, updated_at, ai_enabled, conversation_state)
                VALUES ($1, $2, 'active', NOW(), NOW(), false, 'agent_active')
                ON CONFLICT (phone) DO UPDATE SET updated_at = NOW()
            `, [normalizedPhone, name]);

            // 2. Obtener mensajes de este chat (últimos 50)
            console.log(`   📩 Jalando mensajes...`);
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

            console.log(`   📥 Recibidos ${messages.length} mensajes.`);

            for (const msg of messages) {
                const whatsappId = msg.key.id;
                const isFromMe = msg.key.fromMe;
                const sender = isFromMe ? 'agent' : 'user';
                const timestamp = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date();

                // Extraer texto
                let text = '';
                if (msg.message?.conversation) text = msg.message.conversation;
                else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
                else if (msg.message?.imageMessage?.caption) text = msg.message.imageMessage.caption;
                else if (msg.message?.videoMessage?.caption) text = msg.message.videoMessage.caption;
                else if (msg.message?.documentMessage?.fileName) text = msg.message.documentMessage.fileName;

                if (!text && !msg.message?.imageMessage && !msg.message?.videoMessage && !msg.message?.audioMessage) continue;

                const dbText = text || (msg.message?.imageMessage ? '📷 Imagen' : (msg.message?.videoMessage ? '🎥 Video' : (msg.message?.audioMessage ? '🎤 Audio' : '📎 Archivo')));

                // Guardar mensaje si no existe
                const checkExist = await pool.query("SELECT 1 FROM messages WHERE whatsapp_id = $1", [whatsappId]);
                if (checkExist.rowCount === 0) {
                    await pool.query(`
                        INSERT INTO messages (
                            conversation_phone, sender, text_content, whatsapp_id, timestamp, status, sender_name
                        ) VALUES ($1, $2, $3, $4, $5, 'delivered', $6)
                    `, [normalizedPhone, sender, dbText, whatsappId, timestamp, isFromMe ? 'Tú' : name]);
                }
            }

            // Actualizar el último mensaje de la conversación
            if (messages.length > 0) {
                const lastMsg = messages[0];
                let lastText = lastMsg.message?.conversation || lastMsg.message?.extendedTextMessage?.text || 'Archivo';
                await pool.query("UPDATE conversations SET last_message_text = $1, last_message_timestamp = $2 WHERE phone = $3",
                    [lastText.substring(0, 100), new Date(lastMsg.messageTimestamp * 1000), normalizedPhone]);
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
