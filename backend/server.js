const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const { Pool } = require('pg'); // 👈 1. Importa el driver de Postgres

// --- Configuración del Servidor ---
const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// --- 👈 2. Conexión a la Base de Datos Postgres ---
// Railway inyecta automáticamente la variable DATABASE_URL
// pg la usará por defecto si no pasamos más configuración.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necesario para conexiones en entornos como Railway/Heroku
  }
});

// --- API Endpoints ---

// Endpoint para el webhook de n8n (sin cambios, solo retransmite)
app.post('/api/webhook/receive-message', (req, res) => {
  const messageData = req.body;
  console.log('✅ Webhook recibido, retransmitiendo a los clientes:', messageData);
  io.emit('new-message', messageData); // Retransmite en tiempo real
  res.status(200).json({ success: true, message: 'Mensaje reenviado.' });
});

// 👈 3. NUEVO Endpoint para cargar todo el historial
app.get('/api/history', async (req, res) => {
  try {
    console.log('🔄 Petición de historial recibida. Consultando base de datos...');
    // Asumimos que tienes una tabla llamada 'messages'
    const { rows } = await pool.query('SELECT * FROM messages ORDER BY timestamp ASC');
    
    // Procesamos los datos para que el frontend los entienda
    const messagesByConversation = {};
    const conversationsMap = new Map();

    for (const msg of rows) {
      const phone = msg.conversation_phone; // Asegúrate de que tu columna se llame así
      
      // Construye el objeto de mensaje para el frontend
      const formattedMsg = {
        id: msg.whatsapp_id,
        text: msg.text,
        sender: msg.sender,
        timestamp: new Date(parseInt(msg.timestamp, 10) * 1000).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        status: 'delivered'
      };

      // Agrupa los mensajes por conversación
      if (!messagesByConversation[phone]) {
        messagesByConversation[phone] = [];
      }
      messagesByConversation[phone].push(formattedMsg);

      // Actualiza los datos de la última conversación (para el panel izquierdo)
      conversationsMap.set(phone, {
        id: phone, // Usamos el teléfono como ID único
        contact: { name: msg.contact_name || `Usuario ${phone.slice(-4)}`, phone: phone },
        lastMessage: msg.text,
        timestamp: formattedMsg.timestamp,
        unread: 0, // El historial cargado se considera leído
        status: 'active'
      });
    }

    const conversations = Array.from(conversationsMap.values());
    
    console.log(`✅ Historial cargado: ${conversations.length} conversaciones, ${rows.length} mensajes.`);
    res.json({ conversations, messagesByConversation });

  } catch (error) {
    console.error('❌ Error al cargar el historial desde la base de datos:', error);
    res.status(500).json({ error: 'No se pudo cargar el historial.' });
  }
});

// --- Lógica de Socket.IO ---
io.on('connection', (socket) => {
  console.log(`🟢 Usuario conectado: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`🔴 Usuario desconectado: ${socket.id}`);
  });
  // Lógica para enviar mensajes desde el agente (si la implementas)
  socket.on('send-whatsapp-message', (data) => {
    console.log('➡️ Petición para enviar mensaje a n8n:', data);
    // Aquí podrías tener un webhook en n8n que escuche este evento
  });
});

// --- Iniciar Servidor ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});
