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

    // ✅ LÓGICA CLAVE: Verificar el estado de la conversación
    const conversationState = await pool.query(`
      SELECT conversation_state, agent_id, taken_by_agent_at 
      FROM conversations 
      WHERE phone = $1
    `, [cleanPhone]);

    let shouldActivateAI = true;
    let currentState = 'ai_active';

    if (conversationState.rows.length > 0) {
      currentState = conversationState.rows[0].conversation_state;
      
      // Si la conversación está siendo manejada por un agente, NO activar la IA
      if (currentState === 'agent_active') {
        shouldActivateAI = false;
        console.log(`🚫 IA desactivada - Conversación en modo agente para ${cleanPhone}`);
      }
    }

    // Emitir mensaje al frontend en tiempo real
    const messageData = {
      phone: cleanPhone,
      contact_name: contact_name || `Usuario ${cleanPhone.slice(-4)}`,
      message: message,
      whatsapp_id: whatsapp_id,
      sender_type: sender_type,
      timestamp: timestamp || new Date().toISOString(),
      conversation_state: currentState
    };

    console.log('📤 Emitiendo mensaje al frontend:', messageData);
    io.emit('new-message', messageData);

    // ✅ RESPUESTA AL WEBHOOK
    res.json({ 
      success: true, 
      message: 'Mensaje procesado', 
      ai_should_respond: shouldActivateAI,
      conversation_state: currentState
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


// 5. ENDPOINT PARA ENVIAR MENSAJES A N8N
// Este endpoint envía el mensaje a n8n y espera confirmación
app.post('/api/send-message', async (req, res) => {
  try {
    const { phone, name, message, temp_id } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'Faltan datos requeridos (to, text)' });
    }

    console.log(`📤 Enviando mensaje a n8n: ${phone} -> ${message}`);

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
          phone: phone,
          name:name,
          message: message,
          temp_id: temp_id,
          conversation_state:'agent_active',
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