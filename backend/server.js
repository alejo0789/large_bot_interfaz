const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

// --- CONFIGURACIÓN ---
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// --- CONFIGURACIÓN DE POSTGRESQL con UTF-8 ---
const { types } = require('pg');

// Parsear DATABASE_URL para obtener los componentes
const parseDbUrl = (url) => {
  if (!url) return null;
  const regex = /postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const match = url.match(regex);
  if (match) {
    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: parseInt(match[4]),
      database: match[5]
    };
  }
  return null;
};

const dbConfig = parseDbUrl(process.env.DATABASE_URL);

const pool = new Pool({
  user: dbConfig?.user || 'postgres',
  password: dbConfig?.password || 'root',
  host: dbConfig?.host || 'localhost',
  port: dbConfig?.port || 5432,
  database: dbConfig?.database || 'chatbot_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Forzar encoding UTF-8
  client_encoding: 'UTF8'
});

// Establecer encoding en cada conexión
pool.on('connect', async (client) => {
  try {
    await client.query("SET client_encoding = 'UTF8'");
  } catch (err) {
    console.error('Error setting encoding:', err);
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Configuración para subida de archivos
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear directorio de uploads si no existe
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB max
  fileFilter: (req, file, cb) => {
    // Tipos permitidos
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/webm',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  }
});

// Servir archivos estáticos de uploads
app.use('/uploads', express.static(uploadDir));

// --- ENDPOINTS DE LA API (SOLO LECTURA) ---

// 1. ENDPOINT PARA CARGAR TODAS LAS CONVERSACIONES
app.get('/api/conversations', async (req, res) => {
  try {
    console.log('🔄 Cargando conversaciones...');

    const { rows } = await pool.query(`
      SELECT 
        phone,
        contact_name,
        last_message_text,
        last_message_timestamp,
        unread_count,
        status,
        created_at,
        updated_at
      FROM conversations 
      ORDER BY last_message_timestamp DESC NULLS LAST, created_at DESC
    `);

    const conversations = rows.map(conv => ({
      id: conv.phone,
      contact: {
        name: conv.contact_name,
        phone: conv.phone
      },
      lastMessage: conv.last_message_text || 'No hay mensajes',
      timestamp: conv.last_message_timestamp
        ? new Date(conv.last_message_timestamp).toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit'
        })
        : new Date(conv.created_at).toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit'
        }),
      unread: conv.unread_count || 0,
      status: conv.status || 'active'
    }));

    console.log(`✅ Conversaciones cargadas: ${conversations.length}`);
    res.json(conversations);

  } catch (error) {
    console.error('❌ Error al cargar conversaciones:', error);
    res.status(500).json({ error: 'No se pudieron cargar las conversaciones.' });
  }
});


//  Cmabiar a manual o IA
app.post('/api/conversations/:phone/toggle-ai', async (req, res) => {
  try {
    const { phone } = req.params;
    const { aiEnabled } = req.body;

    console.log(`🤖 Cambiando IA para ${phone}: ${aiEnabled}`);

    const { rows } = await pool.query(`
      UPDATE conversations 
      SET ai_enabled = $1, updated_at = NOW()
      WHERE phone = $2
      RETURNING ai_enabled
    `, [aiEnabled, phone]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    console.log(`✅ IA ${aiEnabled ? 'activada' : 'desactivada'} para ${phone}`);
    res.json({ aiEnabled: rows[0].ai_enabled });

  } catch (error) {
    console.error('❌ Error al cambiar estado de IA:', error);
    res.status(500).json({ error: 'No se pudo cambiar el estado de la IA' });
  }
});

// 2. ENDPOINT PARA CARGAR MENSAJES DE UNA CONVERSACIÓN ESPECÍFICA
app.get('/api/conversations/:phone/messages', async (req, res) => {
  try {
    const { phone } = req.params;
    console.log(`🔄 Cargando mensajes para: ${phone}`);

    const { rows } = await pool.query(`
      SELECT 
        id,
        whatsapp_id,
        conversation_phone,
        sender,
        text_content,
        media_type,
        media_url,
        status,
        timestamp,
        agent_name
      FROM messages 
      WHERE conversation_phone = $1 
      ORDER BY timestamp ASC
    `, [phone]);

    const messages = rows.map(msg => ({
      id: msg.whatsapp_id || msg.id,
      text: msg.text_content,
      sender: msg.sender,
      timestamp: new Date(msg.timestamp).toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      status: msg.status || 'delivered',
      media_type: msg.media_type || null,
      media_url: msg.media_url || null,
      agent_name: msg.agent_name
    }));

    console.log(`✅ Mensajes cargados para ${phone}: ${messages.length}`);
    res.json(messages);

  } catch (error) {
    console.error('❌ Error al cargar mensajes:', error);
    res.status(500).json({ error: 'No se pudieron cargar los mensajes.' });
  }
});

// ... (skip other endpoints) ...

// 5. ENDPOINT PARA ENVIAR MENSAJES A N8N
app.post('/api/send-message', async (req, res) => {
  try {
    const { phone, name, message, temp_id, agent_id, agent_name } = req.body;

    console.log('📥 RAW BODY received:', JSON.stringify(req.body, null, 2));

    if (!phone || !message) {
      return res.status(400).json({ error: 'Faltan datos requeridos (to, text)' });
    }

    console.log(`📤 Enviando mensaje a n8n: ${phone} -> ${message} (Agent: ${agent_name || 'System'})`);

    // 1. GUARDAR EN BD LOCALMENTE (Status: sending)
    try {
      await pool.query(`
            INSERT INTO messages (
                id,
                whatsapp_id, 
                conversation_phone, 
                sender, 
                text_content, 
                status, 
                timestamp,
                agent_id,
                agent_name,
                sender_type
            ) VALUES (
                uuid_generate_v4(),
                $1,
                $2, 
                'agent', 
                $3, 
                'sending', 
                NOW(),
                $4,
                $5,
                'text'
            )
        `, [
        `temp_${temp_id || Date.now()}`,
        phone,
        message,
        agent_id,
        agent_name
      ]);

      // Update conversation last message
      await pool.query(`
            UPDATE conversations 
            SET 
                last_message_text = $1,
                last_message_timestamp = NOW(),
                updated_at = NOW()
            WHERE phone = $2
        `, [message, phone]);

    } catch (dbError) {
      console.error('⚠️ Error guardando mensaje en BD local (no crítico):', dbError);
    }

    // 2. ENVIAR A N8N
    const n8nWebhookUrl = process.env.N8N_SEND_WEBHOOK_URL;

    if (n8nWebhookUrl) {
      const fetch = (await import('node-fetch')).default;

      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phone,
          name: name,
          message: message,
          temp_id: temp_id,
          conversation_state: 'agent_active',
          sender: 'agent',
          agent_id: agent_id,
          agent_name: agent_name
        })
      });

      if (response.ok) {
        console.log('✅ Mensaje enviado a n8n correctamente');
        res.json({ success: true, message: 'Mensaje enviado a n8n' });
      } else {
        const errorBody = await response.text();
        console.error(`❌ Error enviando a N8N: ${response.status} ${response.statusText}`);
        console.error(`   Respuesta: ${errorBody}`);
        throw new Error(`N8N responded with ${response.status}`);
      }
    } else {
      console.log('⚠️ No hay URL de n8n configurada, simulando envío...');
      res.json({ success: true, message: 'Mensaje simulado (configurar N8N_SEND_WEBHOOK_URL)' });
    }

  } catch (error) {
    console.error('❌ Error enviando mensaje a n8n:', error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});
// 3. ENDPOINT PARA MARCAR MENSAJES COMO LEÍDOS
app.post('/api/conversations/:phone/mark-read', async (req, res) => {
  try {
    const { phone } = req.params;

    await pool.query(`
      UPDATE conversations 
      SET unread_count = 0, updated_at = NOW() 
      WHERE phone = $1
    `, [phone]);

    console.log(`✅ Mensajes marcados como leídos para: ${phone}`);
    res.json({ success: true });

  } catch (error) {
    console.error('❌ Error marcando como leído:', error);
    res.status(500).json({ error: 'No se pudo marcar como leído' });
  }
});

// 4. ENDPOINT RECEIVE-MESSAGE (TU ENDPOINT EXISTENTE)
// Este endpoint ya existe en tu configuración actual con n8n
// Solo agregamos la emisión en tiempo real
app.post('/receive-message', async (req, res) => {
  try {
    console.log('📨 Mensaje recibido de n8n:', JSON.stringify(req.body, null, 2));

    const {
      phone,
      contact_name,
      message,
      whatsapp_id,
      sender_type,
      timestamp
    } = req.body;

    if (!phone || !message) {
      console.log('❌ Datos incompletos en mensaje');
      return res.status(400).json({ error: 'Faltan datos requeridos (phone, message)' });
    }

    const cleanPhone = phone.replace(/\s+/g, '');

    // ✅ LÓGICA CORREGIDA: Verificar el estado usando ai_enabled
    const conversationState = await pool.query(`
      SELECT ai_enabled, agent_id, taken_by_agent_at 
      FROM conversations 
      WHERE phone = $1
    `, [cleanPhone]);

    let shouldActivateAI = true;
    let currentState = 'ai_active';

    if (conversationState.rows.length > 0) {
      const aiEnabled = conversationState.rows[0].ai_enabled;

      // Si ai_enabled es false, NO activar la IA
      if (aiEnabled === false) {
        shouldActivateAI = false;
        currentState = 'agent_active';
        console.log(`🚫 IA desactivada - Conversación en modo agente para ${cleanPhone}`);
      } else {
        currentState = 'ai_active';
        console.log(`🤖 IA activada para ${cleanPhone}`);
      }
    } else {
      // Si no existe la conversación, crear una nueva con IA habilitada por defecto
      console.log(`➕ Creando nueva conversación para ${cleanPhone}`);
      await pool.query(`
        INSERT INTO conversations (
          phone, 
          contact_name, 
          ai_enabled, 
          created_at, 
          updated_at
        ) VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (phone) DO NOTHING
      `, [cleanPhone, contact_name || `Usuario ${cleanPhone.slice(-4)}`, true]);
    }

    // Emitir mensaje al frontend en tiempo real
    const messageData = {
      phone: cleanPhone,
      contact_name: contact_name || `Usuario ${cleanPhone.slice(-4)}`,
      message: message,
      whatsapp_id: whatsapp_id,
      sender_type: sender_type,
      timestamp: timestamp || new Date().toISOString(),
      conversation_state: currentState,
      ai_enabled: shouldActivateAI
    };

    console.log('📤 Emitiendo mensaje al frontend:', messageData);
    io.emit('new-message', messageData);

    // ✅ RESPUESTA AL WEBHOOK
    res.json({
      success: true,
      message: 'Mensaje procesado',
      ai_should_respond: shouldActivateAI,
      conversation_state: currentState,
      ai_enabled: shouldActivateAI
    });

  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
// ✅ NUEVO ENDPOINT: Activar modo agente
app.post('/api/conversations/:phone/take-by-agent', async (req, res) => {
  try {
    const { phone } = req.params;
    const { agent_id } = req.body; // ID del agente que toma la conversación

    await pool.query(`
      UPDATE conversations 
      SET 
        conversation_state = 'agent_active',
        agent_id = $1,
        taken_by_agent_at = NOW(),
        updated_at = NOW()
      WHERE phone = $2
    `, [agent_id || 'manual_agent', phone]);

    console.log(`✅ Conversación ${phone} tomada por agente: ${agent_id}`);

    // Notificar a n8n que la IA debe desactivarse para esta conversación
    await notifyN8nStateChange(phone, 'agent_active');

    // Emitir cambio de estado al frontend
    io.emit('conversation-state-changed', {
      phone: phone,
      state: 'agent_active',
      agent_id: agent_id
    });

    res.json({
      success: true,
      message: 'Conversación tomada por agente',
      state: 'agent_active'
    });

  } catch (error) {
    console.error('❌ Error al tomar conversación:', error);
    res.status(500).json({ error: 'Error al tomar conversación' });
  }
});

// ✅ NUEVO ENDPOINT: Reactivar IA
app.post('/api/conversations/:phone/activate-ai', async (req, res) => {
  try {
    const { phone } = req.params;

    await pool.query(`
      UPDATE conversations 
      SET 
        conversation_state = 'ai_active',
        agent_id = NULL,
        taken_by_agent_at = NULL,
        updated_at = NOW()
      WHERE phone = $2
    `, [phone]);

    console.log(`✅ IA reactivada para conversación: ${phone}`);

    // Notificar a n8n que la IA debe reactivarse
    await notifyN8nStateChange(phone, 'ai_active');

    // Emitir cambio de estado al frontend
    io.emit('conversation-state-changed', {
      phone: phone,
      state: 'ai_active'
    });

    res.json({
      success: true,
      message: 'IA reactivada para la conversación',
      state: 'ai_active'
    });

  } catch (error) {
    console.error('❌ Error al reactivar IA:', error);
    res.status(500).json({ error: 'Error al reactivar IA' });
  }
});





// 6. ENDPOINT DE CIERRE DE CONVERSACION
app.post('/api/conversations/:phone/close', async (req, res) => {
  try {
    const { phone } = req.params;
    await pool.query(`
      UPDATE conversations 
      SET status = 'archived', updated_at = NOW() 
      WHERE phone = $1
    `, [phone]);
    res.json({ success: true, message: 'Conversación archivada' });
  } catch (error) {
    console.error('❌ Error cerrando conversación:', error);
    res.status(500).json({ error: 'Error al cerrar conversación' });
  }
});

// 6.5 ENDPOINT PARA ENVIAR ARCHIVOS
app.post('/api/send-file', upload.single('file'), async (req, res) => {
  try {
    const { phone, name, caption } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    if (!phone) {
      return res.status(400).json({ error: 'Falta el número de teléfono' });
    }

    console.log(`📎 Archivo recibido: ${file.originalname} para ${phone}`);

    // URL del archivo subido (Usar WEBHOOK_URL si existe para evitar localhost en producción)
    const baseUrl = process.env.WEBHOOK_URL ? process.env.WEBHOOK_URL.replace('/evolution', '') : `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/uploads/${file.filename}`;

    // Determinar tipo de media
    let mediaType = 'document';
    if (file.mimetype.startsWith('image/')) mediaType = 'image';
    else if (file.mimetype.startsWith('video/')) mediaType = 'video';
    else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';

    // Guardar mensaje en la base de datos
    const messageResult = await pool.query(`
      INSERT INTO messages (
        conversation_phone, 
        sender, 
        text_content, 
        media_type,
        media_url,
        status, 
        timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id
    `, [phone, 'agent', caption || file.originalname, mediaType, fileUrl, 'sending']);

    const savedId = messageResult.rows[0].id;

    // Actualizar la conversación
    await pool.query(`
      UPDATE conversations 
      SET 
        last_message_text = $1,
        last_message_timestamp = NOW(),
        updated_at = NOW()
      WHERE phone = $2
    `, [caption || `📎 ${file.originalname}`, phone]);

    // Enviar a n8n si está configurado
    const n8nWebhookUrl = process.env.N8N_SEND_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      try {
        const fetch = (await import('node-fetch')).default;
        await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phone,
            name: name,
            message: caption || '',
            media_type: mediaType,
            media_url: fileUrl,
            file_name: file.originalname,
            conversation_state: 'agent_active'
          })
        });
        console.log('✅ Archivo enviado a n8n');
      } catch (n8nError) {
        console.error('⚠️ Error enviando a n8n:', n8nError.message);
      }
    }

    // Emitir al frontend
    const messageData = {
      id: savedId, // Usar el ID real
      phone: phone,
      message: caption || file.originalname,
      media_type: mediaType,
      media_url: fileUrl,
      sender_type: 'agent',
      timestamp: new Date().toISOString()
    };
    io.emit('new-message', messageData);

    res.json({
      success: true,
      message: 'Archivo enviado',
      file: {
        name: file.originalname,
        url: fileUrl,
        type: mediaType,
        size: file.size
      }
    });

  } catch (error) {
    console.error('❌ Error enviando archivo:', error);
    res.status(500).json({ error: 'Error al enviar archivo' });
  }
});


// 7. --- ENDPOINTS DE ETIQUETAS (TAGS) ---

// Obtener todas las etiquetas disponibles
app.get('/api/tags', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tags ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    console.error('❌ Error cargando etiquetas:', error);
    res.status(500).json({ error: 'Error al cargar etiquetas' });
  }
});

// Crear nueva etiqueta
app.post('/api/tags', async (req, res) => {
  try {
    const { name, color } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO tags (name, color) VALUES ($1, $2) 
      ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color
      RETURNING *
    `, [name, color || '#808080']);
    res.json(rows[0]);
  } catch (error) {
    console.error('❌ Error creando etiqueta:', error);
    res.status(500).json({ error: 'Error al crear etiqueta' });
  }
});

// Asignar etiqueta a conversación
app.post('/api/conversations/:phone/tags', async (req, res) => {
  try {
    const { phone } = req.params;
    const { tagId } = req.body;

    await pool.query(`
      INSERT INTO conversation_tags (conversation_phone, tag_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [phone, tagId]);

    res.json({ success: true, message: 'Etiqueta asignada' });
  } catch (error) {
    console.error('❌ Error asignando etiqueta:', error);
    res.status(500).json({ error: 'Error al asignar etiqueta' });
  }
});

// Remover etiqueta de conversación
app.delete('/api/conversations/:phone/tags/:tagId', async (req, res) => {
  try {
    const { phone, tagId } = req.params;
    await pool.query(`
      DELETE FROM conversation_tags 
      WHERE conversation_phone = $1 AND tag_id = $2
    `, [phone, tagId]);
    res.json({ success: true, message: 'Etiqueta removida' });
  } catch (error) {
    console.error('❌ Error removiendo etiqueta:', error);
    res.status(500).json({ error: 'Error al remover etiqueta' });
  }
});

// Obtener etiquetas de una conversación
app.get('/api/conversations/:phone/tags', async (req, res) => {
  try {
    const { phone } = req.params;
    const { rows } = await pool.query(`
      SELECT t.* 
      FROM tags t
      JOIN conversation_tags ct ON t.id = ct.tag_id
      WHERE ct.conversation_phone = $1
    `, [phone]);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error obteniendo etiquetas de conversación:', error);
    res.status(500).json({ error: 'Error al obtener etiquetas' });
  }
});


// 8. ENDPOINT LEGACY PARA HISTORIAL COMPLETO (mantener compatibilidad)
app.get('/api/history', async (req, res) => {
  try {
    console.log('🔄 Petición de historial completo (legacy)...');

    // Cargar conversaciones
    const conversationsResult = await pool.query(`
      SELECT * FROM conversations 
      ORDER BY last_message_timestamp DESC NULLS LAST, created_at DESC
    `);

    // Cargar todos los mensajes agrupados por conversación
    const messagesResult = await pool.query(`
      SELECT * FROM messages ORDER BY timestamp ASC
    `);

    const messagesByConversation = {};
    messagesResult.rows.forEach(msg => {
      if (!messagesByConversation[msg.conversation_phone]) {
        messagesByConversation[msg.conversation_phone] = [];
      }
      messagesByConversation[msg.conversation_phone].push({
        id: msg.whatsapp_id || msg.id,
        text: msg.text_content,
        sender: msg.sender,
        timestamp: new Date(msg.timestamp).toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        status: msg.status || 'delivered'
      });
    });

    const conversations = conversationsResult.rows.map(conv => ({
      id: conv.phone,
      contact: {
        name: conv.contact_name,
        phone: conv.phone
      },
      lastMessage: conv.last_message_text || 'No hay mensajes',
      timestamp: conv.last_message_timestamp
        ? new Date(conv.last_message_timestamp).toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit'
        })
        : new Date(conv.created_at).toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit'
        }),
      unread: conv.unread_count || 0,
      status: conv.status || 'active'
    }));

    console.log(`✅ Historial completo: ${conversations.length} conversaciones`);
    res.json({ conversations, messagesByConversation });

  } catch (error) {
    console.error('❌ Error al cargar historial completo:', error);
    res.status(500).json({ error: 'No se pudo cargar el historial.' });
  }
});

// --- LÓGICA DE SOCKET.IO ---
io.on('connection', (socket) => {
  console.log(`🟢 Usuario conectado: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔴 Usuario desconectado: ${socket.id}`);
  });

  // Manejar envío de mensajes desde el agente
  socket.on('send-whatsapp-message', async (data) => {
    try {
      console.log('➡️ Petición para enviar mensaje vía socket:', data);
      const { to, text, temp_id } = data;

      // Reenviar a la API de envío
      const response = await fetch(`http://localhost:${process.env.PORT || 4000}/api/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to, text, temp_id })
      });

      if (response.ok) {
        socket.emit('message-sent', {
          temp_id: temp_id,
          message_id: `sent_${Date.now()}`,
          status: 'delivered'
        });
        console.log('✅ Mensaje procesado correctamente vía socket');
      } else {
        throw new Error('Error en envío');
      }

    } catch (error) {
      console.error('❌ Error enviando mensaje vía socket:', error);
      socket.emit('message-error', {
        temp_id: data.temp_id,
        error: 'Error al enviar mensaje'
      });
    }
  });
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// --- INICIAR SERVIDOR ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
  console.log(`📡 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
  console.log(`🔗 Endpoints disponibles:`);
  console.log(`   - GET  /api/conversations`);
  console.log(`   - GET  /api/conversations/:phone/messages`);
  console.log(`   - N8N Webhook: ${process.env.N8N_SEND_WEBHOOK_URL || 'No configurado'}`);
  console.log(`   - POST /api/conversations/:phone/mark-read`);
  console.log(`   - POST /receive-message (tu endpoint de n8n)`);
  console.log(`   - POST /api/send-message (hacia n8n)`);
  console.log(`   - GET  /health`);
});

// --- MANEJO GRACEFUL DE CIERRE ---
process.on('SIGTERM', () => {
  console.log('🔄 Cerrando servidor...');
  server.close(() => {
    pool.end(() => {
      console.log('✅ Servidor cerrado correctamente');
      process.exit(0);
    });
  });
});