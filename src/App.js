import React, { useState, useEffect, useRef } from 'react';
import { Send, Phone, MoreVertical, Search, Paperclip, Smile, User, Wifi, WifiOff, Check, CheckCheck, Clock } from 'lucide-react';
import { io } from 'socket.io-client';

// --- CONFIGURACIÓN DE CONEXIÓN ---
// Se conecta a la URL del backend proporcionada por Railway o usa localhost para desarrollo.
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';
const socket = io(SOCKET_URL, {
  transports: ['websocket'], // Asegura una conexión estable por WebSockets
  reconnectionAttempts: 5
});

const App = () => {
  // --- ESTADOS DE LA APLICACIÓN ---

  const initialConversation = {
    id: 1,
    contact: { name: 'Bienvenida', phone: '0', avatar: null },
    lastMessage: '¡Comienza a recibir mensajes!',
    timestamp: '',
    unread: 0,
    status: 'pending'
  };

  const [conversations, setConversations] = useState([initialConversation]);
  const [selectedConversation, setSelectedConversation] = useState(initialConversation);
  const [messagesByConversation, setMessagesByConversation] = useState({
    [initialConversation.contact.phone]: [
      {
        id: Date.now(),
        text: '🎯 Interfaz lista para recibir mensajes por conversación.',
        sender: 'system',
        timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      }
    ]
  });

  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const messagesEndRef = useRef(null);

  // --- LÓGICA PRINCIPAL ---

  /**
   * Maneja un nuevo mensaje entrante desde el backend (originado en n8n).
   * Distingue entre mensajes de clientes, bots y confirmaciones de mensajes de agentes.
   * @param {object} messageData - Los datos del mensaje recibido.
   */
  const handleRealMessageFromN8n = (messageData) => {
    console.log('📨 Mensaje procesado desde n8n:', messageData);

    const phone = (messageData.phone || messageData.from || '').replace(/\s+/g, '');
    if (!phone) {
        console.error("Error: Mensaje de n8n no contiene un número de teléfono.", messageData);
        return;
    }

    // CASO 1: Es una confirmación de un mensaje enviado por el agente desde la UI
    if (messageData.sender_type === 'agent' && messageData.temp_id) {
      setMessagesByConversation(prev => {
        const conversationMessages = prev[phone] || [];
        const updatedMessages = conversationMessages.map(msg => 
          msg.id === messageData.temp_id 
            ? { ...msg, status: 'delivered', id: messageData.whatsapp_id || msg.id } // Actualiza el estado y el ID
            : msg
        );
        return { ...prev, [phone]: updatedMessages };
      });
      return; // Termina la ejecución para no procesarlo como mensaje de cliente/bot
    }

    // CASO 2: Es un mensaje nuevo (del cliente o del bot)
    // Determina el remitente: si n8n envía sender_type: 'bot', se mostrará como 'agent' (azul)
    const sender = messageData.sender_type === 'bot' ? 'agent' : 'customer';

    const newMsg = {
      id: messageData.whatsapp_id || Date.now(),
      text: messageData.message || messageData.text?.body || 'Sin contenido',
      sender: sender, // Asigna el remitente determinado
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      status: 'received'
    };

    setMessagesByConversation(prev => ({
      ...prev,
      [phone]: [...(prev[phone] || []), newMsg]
    }));
    
    const contactName = messageData.contact_name || messageData.profile?.name || `Usuario ${phone.slice(-4)}`;

    setConversations(prev => {
      const conversationsWithoutWelcome = prev.filter(c => c.contact.phone !== '0');
      const existingConvIndex = conversationsWithoutWelcome.findIndex(conv => conv.contact.phone === phone);
      
      let updatedConversations;
      if (existingConvIndex !== -1) {
        const existingConv = conversationsWithoutWelcome[existingConvIndex];
        const updatedConv = {
          ...existingConv,
          lastMessage: newMsg.text,
          timestamp: newMsg.timestamp,
          unread: (selectedConversation.contact.phone === phone) ? 0 : existingConv.unread + 1,
          status: 'active'
        };
        updatedConversations = [updatedConv, ...conversationsWithoutWelcome.filter(c => c.contact.phone !== phone)];
      } else {
        const newConv = {
          id: Date.now(),
          contact: { name: contactName, phone: phone, avatar: null },
          lastMessage: newMsg.text,
          timestamp: newMsg.timestamp,
          unread: 1,
          status: 'active'
        };
        updatedConversations = [newConv, ...conversationsWithoutWelcome];
      }
      return updatedConversations;
    });

    if (Notification.permission === 'granted') {
      new Notification(`Nuevo mensaje de ${contactName}`, { body: newMsg.text, icon: '/favicon.ico' });
    }
  };

  /**
   * Envía un mensaje desde la interfaz del agente.
   * Lo muestra inmediatamente en la UI (actualización optimista) y lo envía al backend.
   */
  const sendMessage = async () => {
    if (!newMessage.trim() || selectedConversation.contact.phone === '0') return;

    const tempId = Date.now(); // ID temporal para seguimiento
    const targetPhone = selectedConversation.contact.phone;

    const message = {
      id: tempId,
      text: newMessage,
      sender: 'agent',
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      status: 'sending' // Estado inicial: enviando
    };
    
    // Actualización optimista: muestra el mensaje en la UI inmediatamente
    setMessagesByConversation(prev => ({
        ...prev,
        [targetPhone]: [...(prev[targetPhone] || []), message]
    }));
    
    // Envía el mensaje al backend para que n8n lo procese
    socket.emit('send-whatsapp-message', { 
      to: targetPhone, 
      text: newMessage,
      temp_id: tempId // Envía el ID temporal para la confirmación
    });

    setNewMessage('');
  };

  const selectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setConversations(prev => prev.map(conv => 
      conv.id === conversation.id ? { ...conv, unread: 0 } : conv
    ));
  };

  // --- HOOKS DE EFECTO ---

  useEffect(() => {
    const onConnect = () => { console.log('✅ Conectado al backend'); setIsConnected(true); };
    const onDisconnect = () => { console.log('❌ Desconectado del backend'); setIsConnected(false); };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('new-message', handleRealMessageFromN8n);

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new-message', handleRealMessageFromN8n);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesByConversation, selectedConversation]);

  // --- RENDERIZADO ---

  const getStatusColor = () => isConnected ? 'bg-green-500' : 'bg-red-500';
  const getStatusText = () => isConnected ? 'Conectado' : 'Desconectado';
  
  const currentMessages = messagesByConversation[selectedConversation.contact.phone] || [];

  const MessageStatus = ({ status }) => {
    if (status === 'sending') return <Clock className="w-3 h-3 text-gray-400" />;
    if (status === 'delivered') return <CheckCheck className="w-4 h-4 text-blue-300" />;
    return null;
  };

  return (
    <div className="flex h-screen bg-gray-100 font-inter text-sm">
      {/* Panel Lateral de Conversaciones */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold text-gray-800">Large IA</h1>
              <p className="text-xs text-gray-500">Canal de WhatsApp</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2.5 h-2.5 rounded-full transition-colors ${getStatusColor()}`}></div>
              <span className="text-xs text-gray-600">{getStatusText()}</span>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar conversaciones..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => selectConversation(conversation)}
              className={`p-3 flex items-center space-x-3 cursor-pointer border-l-4 ${selectedConversation.id === conversation.id ? 'bg-blue-50 border-blue-500' : 'border-transparent hover:bg-gray-50'}`}
            >
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-semibold">
                  <User className="w-6 h-6" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900 truncate">{conversation.contact.name}</h3>
                  <span className="text-xs text-gray-500">{conversation.timestamp}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-600 truncate">{conversation.lastMessage}</p>
                  {conversation.unread > 0 && (
                    <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 font-semibold">
                      {conversation.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel Principal del Chat */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{selectedConversation.contact.name}</h2>
              <p className="text-xs text-gray-600">{selectedConversation.contact.phone}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><Phone className="w-5 h-5" /></button>
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><MoreVertical className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {currentMessages.map((message) => (
            <div
              key={message.id}
              className={`flex items-end gap-2 ${message.sender === 'agent' ? 'justify-end' : message.sender === 'system' ? 'justify-center' : 'justify-start'}`}
            >
              <div className={`max-w-lg px-4 py-2 rounded-lg shadow-sm ${
                  message.sender === 'agent' ? 'bg-blue-500 text-white rounded-br-none' :
                  message.sender === 'system' ? 'bg-gray-200 text-gray-600 text-xs text-center w-full' :
                  'bg-white text-gray-800 rounded-bl-none'
                }`}
              >
                <p className="text-sm break-words">{message.text}</p>
                <div className="flex items-center justify-end gap-1 text-xs mt-1 opacity-75">
                  <span>{message.timestamp}</span>
                  {message.sender === 'agent' && <MessageStatus status={message.status} />}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-center space-x-3">
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><Paperclip className="w-5 h-5" /></button>
            <div className="flex-1 relative">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={selectedConversation.contact.phone === '0' ? 'Selecciona una conversación para empezar...' : 'Escribe un mensaje...'}
                className="w-full px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                disabled={selectedConversation.contact.phone === '0'}
              />
              <button className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"><Smile className="w-5 h-5" /></button>
            </div>
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || selectedConversation.contact.phone === '0'}
              className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
