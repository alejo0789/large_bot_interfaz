// 1. Importar las dependencias necesarias
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

// 2. Configuración inicial
const app = express();
app.use(cors()); // Habilita CORS para permitir que tu frontend se conecte
app.use(express.json()); // Permite al servidor entender JSON en las peticiones

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // ¡IMPORTANTE! En un entorno de producción, cambia "*" por la URL de tu frontend.
    methods: ["GET", "POST"]
  }
});

// 3. Definir el endpoint para el webhook de n8n
// Esta es la URL que pondrás en tu workflow de n8n
app.post('/api/webhook/receive-message', (req, res) => {
  const messageData = req.body;
  
  // Imprime en la consola del servidor para verificar que el mensaje llegó
  console.log('✅ Mensaje recibido desde n8n:', messageData);

  // 4. Reenviar el mensaje a TODOS los clientes React conectados
  io.emit('new-message', messageData);

  // 5. Responder a n8n para que sepa que todo fue exitoso
  res.status(200).json({ success: true, message: 'Mensaje reenviado a los clientes.' });
});

// 6. Lógica de conexión de Socket.IO (para depuración)
io.on('connection', (socket) => {
  console.log(`🟢 Un usuario se ha conectado con el ID: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`🔴 El usuario ${socket.id} se ha desconectado.`);
  });
});

// 7. Iniciar el servidor
const PORT = process.env.PORT || 4000; // Usa el puerto de Railway o el 4000 para desarrollo local
server.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});