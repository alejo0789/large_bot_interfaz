import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Phone, MoreVertical, Search, Paperclip, Smile, User, CheckCheck, Clock } from 'lucide-react';
import { io } from 'socket.io-client';

// --- CONFIGURACIÓN DE CONEXIÓN ---
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnectionAttempts: 5
});

const App = () => {
  // --- ESTADOS DE LA APLICACIÓN ---
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [isLoading, setIsLoading] = useState(true); // Estado para la pantalla de carga
  
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);

  // --- LÓGICA PRINCIPAL ---

  /**
   * Maneja los mensajes nuevos que llegan en tiempo real vía WebSocket.
   * @param {object} messageData - Datos del nuevo mensaje.
   */
  const handleRealTimeMessage = (messageData) => {
    console.log('📨 Mensaje en tiempo real recibido:', messageData);
    const phone = (messageData.phone || messageData.from || '').replace(/\s+/g, '');
    if (!phone) return;

    const sender = messageData.sender_type === 'bot' ? 'agent' : 'customer';

    const newMsg = {
      id: messageData.whatsapp_id || Date.now(),
      text: messageData.message || 'Sin contenido',
      sender: sender,
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      status: 'received'
    };

    setMessagesByConversation(prev => ({
      ...prev,
      [phone]: [...(prev[phone] || []), newMsg]
    }));

    // Actualiza la conversación en la lista
    setConversations(prev => {
        const convIndex = prev.findIndex(c => c.contact.phone === phone);
        if (convIndex > -1) {
            const updatedConv = {
                ...prev[convIndex],
                lastMessage: newMsg.text,
                timestamp: newMsg.timestamp,
                unread: selectedConversation?.contact.phone === phone ? 0 : prev[convIndex].unread + 1
            };
            // Mueve la conversación actualizada al principio
            const newConversations = [...prev];
            newConversations.splice(convIndex, 1);
            return [updatedConv, ...newConversations];
        }
        // Si la conversación no existe, la creamos (esto puede pasar si el historial inicial no la tenía)
        const contactName = messageData.contact_name || `Usuario ${phone.slice(-4)}`;
        const newConv = {
            id: phone,
            contact: { name: contactName, phone: phone },
            lastMessage: newMsg.text,
            timestamp: newMsg.timestamp,
            unread: 1,
            status: 'active'
        };
        return [newConv, ...prev];
    });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const tempId = Date.now();
    const targetPhone = selectedConversation.contact.phone;

    const message = {
      id: tempId,
      text: newMessage,
      sender: 'agent',
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      status: 'sending'
    };
    
    setMessagesByConversation(prev => ({
        ...prev,
        [targetPhone]: [...(prev[targetPhone] || []), message]
    }));
    
    socket.emit('send-whatsapp-message', { 
      to: targetPhone, 
      text: newMessage,
      temp_id: tempId
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

  // Efecto para cargar el historial inicial desde el backend
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`${API_URL}/api/history`);
        if (!response.ok) throw new Error('La respuesta del servidor no fue OK');
        
        const data = await response.json();
        
        setConversations(data.conversations || []);
        setMessagesByConversation(data.messagesByConversation || {});
        
        if (data.conversations && data.conversations.length > 0) {
          setSelectedConversation(data.conversations[0]);
        }
      } catch (error) {
        console.error("Error al cargar el historial:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []); // El array vacío asegura que se ejecute solo una vez

  // Efecto para la conexión WebSocket
  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('new-message', handleRealTimeMessage);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new-message', handleRealTimeMessage);
    };
  }, [selectedConversation]); // Dependencia clave para la lógica de 'unread'

  // Efecto para el auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesByConversation, selectedConversation]);

  // --- LÓGICA DE BÚSQUEDA ---
  const filteredConversations = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return conversations;
    return conversations.filter(c =>
      c.contact.name.toLowerCase().includes(query) ||
      c.contact.phone.includes(query)
    );
  }, [conversations, searchQuery]);

  // --- RENDERIZADO ---

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Cargando historial de mensajes...</p>
        </div>
      </div>
    );
  }

  const getStatusColor = () => isConnected ? 'bg-green-500' : 'bg-red-500';
  const getStatusText = () => isConnected ? 'Conectado' : 'Desconectado';
  const currentMessages = selectedConversation ? messagesByConversation[selectedConversation.contact.phone] || [] : [];

  const MessageStatus = ({ status }) => {
    if (status === 'sending') return <Clock className="w-3 h-3 text-gray-400" />;
    if (status === 'delivered') return <CheckCheck className="w-4 h-4 text-blue-300" />;
    return null;
  };

  return (
    <div className="flex h-screen bg-gray-100 font-inter text-sm">
      {/* Panel Lateral */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold text-gray-800">Chat n8n</h1>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => selectConversation(conversation)}
              className={`p-3 flex items-center space-x-3 cursor-pointer border-l-4 ${selectedConversation?.id === conversation.id ? 'bg-blue-50 border-blue-500' : 'border-transparent hover:bg-gray-50'}`}
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

      {/* Panel Principal */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Encabezado del Chat */}
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
            {/* Área de Mensajes */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              {currentMessages.map((message) => (
                <div key={message.id} className={`flex items-end gap-2 ${message.sender === 'agent' ? 'justify-end' : message.sender === 'system' ? 'justify-center' : 'justify-start'}`}>
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
            {/* Campo de Entrada */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><Paperclip className="w-5 h-5" /></button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Escribe un mensaje..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"><Smile className="w-5 h-5" /></button>
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-gray-500">
              {conversations.length > 0 ? "Selecciona una conversación para comenzar." : "No hay conversaciones activas."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
