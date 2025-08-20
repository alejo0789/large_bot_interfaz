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

// --- CONFIGURACIÓN DE POSTGRESQL ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json());

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
        status,
        timestamp
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
      status: msg.status || 'delivered'
    }));

    console.log(`✅ Mensajes cargados para ${phone}: ${messages.length}`);
    res.json(messages);

  } catch (error) {
    console.error('❌ Error al cargar mensajes:', error);
    res.status(500).json({ error: 'No se pudieron cargar los mensajes.' });
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

    // n8n ya se encargó de actualizar la base de datos
    // Solo emitir la notificación en tiempo real para el frontend
    const messageData = {
      phone: cleanPhone,
      contact_name: contact_name || `Usuario ${cleanPhone.slice(-4)}`,
      message: message,
      whatsapp_id: whatsapp_id,
      sender_type: sender_type,
      timestamp: timestamp || new Date().toISOString()
    };

    console.log('📤 Emitiendo mensaje en tiempo real al frontend:', messageData);
    io.emit('new-message', messageData);

    res.json({ success: true, message: 'Mensaje procesado y enviado al frontend' });

  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 5. ENDPOINT PARA ENVIAR MENSAJES A N8N
// Este endpoint envía el mensaje a n8n y espera confirmación
app.post('/api/send-message', async (req, res) => {
  try {
    const { to, text, temp_id } = req.body;
    
    if (!to || !text) {
      return res.status(400).json({ error: 'Faltan datos requeridos (to, text)' });
    }

    console.log(`📤 Enviando mensaje a n8n: ${to} -> ${text}`);

    // Aquí harías la petición HTTP a tu webhook de n8n para enviar el mensaje
    // Ejemplo:
    const n8nWebhookUrl = process.env.N8N_SEND_WEBHOOK_URL;
    
    if (n8nWebhookUrl) {
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: to,
          text: text,
          temp_id: temp_id,
          sender: 'agent'
        })
      });

      if (response.ok) {
        console.log('✅ Mensaje enviado a n8n correctamente');
        res.json({ success: true, message: 'Mensaje enviado a n8n' });
      } else {
        throw new Error('Error en respuesta de n8n');
      }
    } else {
      // Si no hay URL de n8n configurada, simular envío exitoso
      console.log('⚠️ No hay URL de n8n configurada, simulando envío...');
      res.json({ success: true, message: 'Mensaje simulado (configurar N8N_SEND_WEBHOOK_URL)' });
    }

  } catch (error) {
    console.error('❌ Error enviando mensaje a n8n:', error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// 6. ENDPOINT LEGACY PARA HISTORIAL COMPLETO (mantener compatibilidad)
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