/**
 * Script para importar mensajes históricos desde Evolution API
 * 
 * Este script:
 * 1. Obtiene todas las conversaciones de la DB
 * 2. Para cada conversación, trae los mensajes históricos de Evolution API
 * 3. Los guarda en la base de datos local
 * 
 * Uso: node scripts/import-historical-messages.js [--limit=10] [--phone=573123456789]
 */

require('dotenv').config();
const { pool } = require('../src/config/database');
const axios = require('axios');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

// Configuración
const BATCH_SIZE = 10; // Procesar 10 conversaciones a la vez
const MESSAGES_PER_CONVERSATION = 100; // Traer últimos 100 mensajes por conversación

// Parse command line arguments
const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const phoneArg = args.find(arg => arg.startsWith('--phone='));
const CONVERSATION_LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const SINGLE_PHONE = phoneArg ? phoneArg.split('=')[1] : null;

/**
 * Traer mensajes de una conversación desde Evolution API usando /chat/findChats
 */
async function fetchMessagesFromEvolution(phone) {
    try {
        console.log(`  📡 Fetching chat data from Evolution API for ${phone}...`);

        // Endpoint correcto: /chat/findChats/{instance}
        const url = `${EVOLUTION_API_URL}/chat/findChats/${EVOLUTION_INSTANCE}`;

        // Buscar el chat específico con filtro por remoteJid
        const response = await axios.post(url, {
            where: {
                id: `${phone}@s.whatsapp.net`
            }
        }, {
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        // La respuesta puede venir en diferentes formatos
        let chats = [];
        if (Array.isArray(response.data)) {
            chats = response.data;
        } else if (response.data && Array.isArray(response.data.chats)) {
            chats = response.data.chats;
        } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
            chats = response.data.data;
        }

        if (chats.length === 0) {
            console.log(`  ⚠️  No chat found for ${phone}`);
            return [];
        }

        // Tomar el primer chat (debería ser único)
        const chat = chats[0];
        console.log(`  ✅ Found chat for ${phone}`);

        // DEBUG: Ver estructura del chat
        console.log(`  🔍 Chat keys:`, Object.keys(chat));
        console.log(`  🔍 Chat data sample:`, JSON.stringify(chat).substring(0, 500));

        // Extraer mensajes del chat
        let messages = [];
        if (chat.messages && Array.isArray(chat.messages)) {
            messages = chat.messages;
        } else if (chat.lastMessages && Array.isArray(chat.lastMessages)) {
            messages = chat.lastMessages;
        }

        // Limitar a MESSAGES_PER_CONVERSATION más recientes
        if (messages.length > MESSAGES_PER_CONVERSATION) {
            messages = messages.slice(0, MESSAGES_PER_CONVERSATION);
        }

        console.log(`  ✅ Found ${messages.length} messages for ${phone}`);
        return messages;

    } catch (error) {
        if (error.response?.status === 404) {
            console.log(`  ℹ️  No chat found for ${phone} (404)`);
        } else {
            console.error(`  ❌ Error fetching chat for ${phone}:`, error.message);
            if (error.response?.data) {
                console.log(`      API Response:`, JSON.stringify(error.response.data).substring(0, 300));
            }
        }
        return [];
    }
}

/**
 * Guardar mensaje en la base de datos
 */
async function saveMessageToDB(phone, message) {
    try {
        // Extraer información del mensaje
        const messageData = message.message || {};
        const messageKey = message.key || {};

        // Determinar el tipo de mensaje y extraer el texto
        let messageText = '';
        let mediaType = null;
        let mediaUrl = null;

        if (messageData.conversation) {
            messageText = messageData.conversation;
        } else if (messageData.extendedTextMessage) {
            messageText = messageData.extendedTextMessage.text;
        } else if (messageData.imageMessage) {
            messageText = messageData.imageMessage.caption || '[Imagen]';
            mediaType = 'image';
            mediaUrl = messageData.imageMessage.url;
        } else if (messageData.videoMessage) {
            messageText = messageData.videoMessage.caption || '[Video]';
            mediaType = 'video';
            mediaUrl = messageData.videoMessage.url;
        } else if (messageData.audioMessage) {
            messageText = '[Audio]';
            mediaType = 'audio';
            mediaUrl = messageData.audioMessage.url;
        } else if (messageData.documentMessage) {
            messageText = messageData.documentMessage.fileName || '[Documento]';
            mediaType = 'document';
            mediaUrl = messageData.documentMessage.url;
        } else {
            messageText = '[Mensaje no compatible]';
        }

        // Determinar sender_type
        const senderType = messageKey.fromMe ? 'agent' : 'customer';

        // Timestamp
        const timestamp = message.messageTimestamp
            ? new Date(parseInt(message.messageTimestamp) * 1000)
            : new Date();

        // WhatsApp ID único
        const whatsappId = messageKey.id || `${phone}_${timestamp.getTime()}`;

        // Insertar en la base de datos (evitar duplicados)
        await pool.query(`
            INSERT INTO messages (
                phone,
                whatsapp_id,
                message_text,
                sender_type,
                timestamp,
                media_type,
                media_url,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (whatsapp_id) DO NOTHING
        `, [
            phone,
            whatsappId,
            messageText,
            senderType,
            timestamp,
            mediaType,
            mediaUrl
        ]);

        return true;

    } catch (error) {
        console.error(`    ❌ Error saving message:`, error.message);
        return false;
    }
}

/**
 * Procesar una conversación
 */
async function processConversation(phone, contactName) {
    console.log(`\n📞 Processing ${contactName} (${phone})`);

    // 1. Traer mensajes de Evolution API
    const messages = await fetchMessagesFromEvolution(phone);

    if (messages.length === 0) {
        console.log(`  ⏭️  No messages to import`);
        return { phone, imported: 0 };
    }

    // 2. Guardar cada mensaje en la DB
    let imported = 0;
    for (const message of messages) {
        const saved = await saveMessageToDB(phone, message);
        if (saved) imported++;
    }

    console.log(`  ✅ Imported ${imported}/${messages.length} messages`);

    // 3. Actualizar last_message en conversations
    if (imported > 0) {
        const lastMessage = messages[0]; // El más reciente
        const messageData = lastMessage.message || {};
        let lastMessageText = messageData.conversation ||
            messageData.extendedTextMessage?.text ||
            '[Media]';

        await pool.query(`
            UPDATE conversations 
            SET 
                last_message_text = $1,
                last_message_timestamp = $2,
                updated_at = NOW()
            WHERE phone = $3
        `, [
            lastMessageText,
            new Date(parseInt(lastMessage.messageTimestamp) * 1000),
            phone
        ]);
    }

    return { phone, imported };
}

/**
 * Script principal
 */
async function main() {
    console.log('\n🚀 Starting Historical Messages Import');
    console.log('=====================================');
    console.log(`Evolution API: ${EVOLUTION_API_URL}`);
    console.log(`Instance: ${EVOLUTION_INSTANCE}`);
    if (CONVERSATION_LIMIT) console.log(`Limit: ${CONVERSATION_LIMIT} conversations`);
    if (SINGLE_PHONE) console.log(`Single Phone: ${SINGLE_PHONE}`);
    console.log('=====================================\n');

    try {
        // 1. Obtener conversaciones de la DB
        let query = 'SELECT phone, contact_name FROM conversations ORDER BY created_at DESC';
        const params = [];

        if (SINGLE_PHONE) {
            query = 'SELECT phone, contact_name FROM conversations WHERE phone = $1';
            params.push(SINGLE_PHONE);
        } else if (CONVERSATION_LIMIT) {
            query += ` LIMIT ${CONVERSATION_LIMIT}`;
        }

        const { rows: conversations } = await pool.query(query, params);
        console.log(`📊 Found ${conversations.length} conversations to process\n`);

        if (conversations.length === 0) {
            console.log('No conversations found. Exiting.');
            return;
        }

        // 2. Procesar en lotes
        const results = [];
        for (let i = 0; i < conversations.length; i += BATCH_SIZE) {
            const batch = conversations.slice(i, i + BATCH_SIZE);
            console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(conversations.length / BATCH_SIZE)}`);

            const batchResults = await Promise.all(
                batch.map(conv => processConversation(conv.phone, conv.contact_name))
            );

            results.push(...batchResults);

            // Pausa entre lotes para no saturar la API
            if (i + BATCH_SIZE < conversations.length) {
                console.log('\n⏸️  Waiting 2 seconds before next batch...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // 3. Resumen final
        console.log('\n\n=====================================');
        console.log('✅ IMPORT COMPLETED');
        console.log('=====================================');
        const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
        const conversationsWithMessages = results.filter(r => r.imported > 0).length;
        console.log(`Total conversations processed: ${results.length}`);
        console.log(`Conversations with messages: ${conversationsWithMessages}`);
        console.log(`Total messages imported: ${totalImported}`);
        console.log('=====================================\n');

    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Ejecutar
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
