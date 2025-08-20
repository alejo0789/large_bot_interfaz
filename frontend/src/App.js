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
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);

  // --- FUNCIONES DE API ---

  /**
   * Carga todas las conversaciones desde el backend
   */
  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Cargando conversaciones...');
      
      const response = await fetch(`${API_URL}/api/conversations`);
      if (!response.ok) throw new Error('Error al cargar conversaciones');
      
      const data = await response.json();
      setConversations(data);
      
      console.log(`✅ Conversaciones cargadas: ${data.length}`);
      
      // Si hay conversaciones, seleccionar la primera automáticamente
      if (data.length > 0) {
        await selectConversation(data[0]);
      }
    } catch (error) {
      console.error("❌ Error al cargar conversaciones:", error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Carga los mensajes de una conversación específica
   */
  const fetchMessages = async (phone) => {
    try {
      setIsLoadingMessages(true);
      console.log(`🔄 Cargando mensajes para: ${phone}`);
      
      const response = await fetch(`${API_URL}/api/conversations/${phone}/messages`);
      if (!response.ok) throw new Error('Error al cargar mensajes');
      
      const messages = await response.json();
      
      setMessagesByConversation(prev => ({
        ...prev,
        [phone]: messages
      }));
      
      console.log(`✅ Mensajes cargados para ${phone}: ${messages.length}`);
      return messages;
    } catch (error) {
      console.error(`❌ Error al cargar mensajes para ${phone}:`, error);
      return [];
    } finally {
      setIsLoadingMessages(false);
    }
  };

  /**
   * Marca una conversación como leída
   */
  const markConversationAsRead = async (phone) => {
    try {
      await fetch(`${API_URL}/api/conversations/${phone}/mark-read`, {
        method: 'POST'
      });
      
      console.log(`✅ Conversación ${phone} marcada como leída`);
      
      // Actualizar el estado local
      setConversations(prev => prev.map(conv => 
        conv.contact.phone === phone ? { ...conv, unread: 0 } : conv
      ));
    } catch (error) {
      console.error(`❌ Error al marcar como leída la conversación ${phone}:`, error);
    }
  };

  // --- LÓGICA PRINCIPAL ---

  /**
   * Maneja los mensajes nuevos que llegan en tiempo real vía WebSocket.
   */
  const handleRealTimeMessage = (messageData) => {
    console.log('📨 Mensaje en tiempo real recibido:', messageData);
    const phone = (messageData.phone || messageData.from || '').replace(/\s+/g, '');
    if (!phone) return;

    const sender = messageData.sender_type === 'bot' ? 'agent' : 
                  messageData.sender_type === 'agent' ? 'agent' : 'customer';

    const newMsg = {
      id: messageData.whatsapp_id || Date.now(),
      text: messageData.message || 'Sin contenido',
      sender: sender,
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      status: 'received'
    };

    // Agregar el mensaje solo si la conversación está cargada
    setMessagesByConversation(prev => {
      if (prev[phone]) {
        return {
          ...prev,
          [phone]: [...prev[phone], newMsg]
        };
      }
      return prev;
    });

    // Actualizar la conversación en la lista
    setConversations(prev => {
      const convIndex = prev.findIndex(c => c.contact.phone === phone);
      if (convIndex > -1) {
        const isCurrentConversation = selectedConversation?.contact.phone === phone;
        const updatedConv = {
          ...prev[convIndex],
          lastMessage: newMsg.text,
          timestamp: newMsg.timestamp,
          unread: isCurrentConversation ? 0 : prev[convIndex].unread + 1
        };
        
        // Si es la conversación actual, marcar como leída automáticamente
        if (isCurrentConversation) {
          markConversationAsRead(phone);
        }
        
        // Mover la conversación al principio
        const newConversations = [...prev];
        newConversations.splice(convIndex, 1);
        return [updatedConv, ...newConversations];
      } else {
        // Crear nueva conversación si no existe
        const contactName = messageData.contact_name || `Usuario ${phone.slice(-4)}`;
        const newConv = {
          id: phone,
          contact: { name: contactName, phone: phone },
          lastMessage: newMsg.text,
          timestamp: newMsg.timestamp,
          unread: selectedConversation?.contact.phone === phone ? 0 : 1,
          status: 'active'
        };
        return [newConv, ...prev];
      }
    });
  };

  /**
   * Selecciona una conversación y carga sus mensajes
   */
  const selectConversation = async (conversation) => {
    console.log('🎯 Seleccionando conversación:', conversation.contact.phone);
    
    setSelectedConversation(conversation);
    
    // Marcar como leída si tiene mensajes no leídos
    if (conversation.unread > 0) {
      await markConversationAsRead(conversation.contact.phone);
    }
    
    // Cargar mensajes si no están en caché
    if (!messagesByConversation[conversation.contact.phone]) {
      await fetchMessages(conversation.contact.phone);
    }
  };

  /**
   * Envía un mensaje
   */
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
    
    // Agregar mensaje temporalmente a la UI
    setMessagesByConversation(prev => ({
      ...prev,
      [targetPhone]: [...(prev[targetPhone] || []), message]
    }));
    
    // Actualizar la conversación en la lista
    setConversations(prev => prev.map(conv => 
      conv.contact.phone === targetPhone 
        ? { ...conv, lastMessage: newMessage, timestamp: message.timestamp }
        : conv
    ));
    
    // Enviar a través del socket
    socket.emit('send-whatsapp-message', { 
      to: targetPhone, 
      text: newMessage,
      temp_id: tempId
    });

    setNewMessage('');
  };

  /**
   * Refresca las conversaciones manualmente
   */
  const refreshConversations = async () => {
    console.log('🔄 Refrescando conversaciones...');
    await fetchConversations();
  };

  // --- HOOKS DE EFECTO ---

  // Cargar conversaciones al montar el componente
  useEffect(() => {
    fetchConversations();
  }, []);

  // Configurar eventos de Socket.IO
  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      console.log('🟢 Conectado al servidor');
    };
    
    const onDisconnect = () => {
      setIsConnected(false);
      console.log('🔴 Desconectado del servidor');
    };

    const onMessageSent = (data) => {
      console.log('✅ Mensaje confirmado como enviado:', data);
      const { temp_id, message_id, status } = data;
      
      // Actualizar el estado del mensaje temporal
      setMessagesByConversation(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(phone => {
          newState[phone] = newState[phone].map(msg => 
            msg.id === temp_id 
              ? { ...msg, id: message_id, status: status }
              : msg
          );
        });
        return newState;
      });
    };

    const onMessageError = (data) => {
      console.error('❌ Error enviando mensaje:', data);
      const { temp_id, error } = data;
      
      // Marcar el mensaje como fallido
      setMessagesByConversation(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(phone => {
          newState[phone] = newState[phone].map(msg => 
            msg.id === temp_id 
              ? { ...msg, status: 'failed', text: `${msg.text} ❌` }
              : msg
          );
        });
        return newState;
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('new-message', handleRealTimeMessage);
    socket.on('message-sent', onMessageSent);
    socket.on('message-error', onMessageError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new-message', handleRealTimeMessage);
      socket.off('message-sent', onMessageSent);
      socket.off('message-error', onMessageError);
    };
  }, [selectedConversation, messagesByConversation]);

  // Auto-scroll cuando cambian los mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesByConversation, selectedConversation]);

  // --- LÓGICA DE BÚSQUEDA ---
  const filteredConversations = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return conversations;
    return conversations.filter(c =>
      c.contact.name.toLowerCase().includes(query) ||
      c.contact.phone.includes(query) ||
      c.lastMessage.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  // --- COMPONENTES AUXILIARES ---
  const MessageStatus = ({ status }) => {
    if (status === 'sending') return <Clock className="w-3 h-3 text-gray-400 animate-pulse" />;
    if (status === 'delivered') return <CheckCheck className="w-4 h-4 text-blue-300" />;
    if (status === 'failed') return <span className="text-red-400 text-xs">❌</span>;
    return null;
  };

  const RefreshButton = () => (
    <button
      onClick={refreshConversations}
      className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
      title="Refrescar conversaciones"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  );

  // --- RENDERIZADO ---
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Cargando conversaciones...</p>
        </div>
      </div>
    );
  }

  const getStatusColor = () => isConnected ? 'bg-green-500' : 'bg-red-500';
  const getStatusText = () => isConnected ? 'Conectado' : 'Desconectado';
  const currentMessages = selectedConversation ? messagesByConversation[selectedConversation.contact.phone] || [] : [];

  return (
    <div className="flex h-screen bg-gray-100 font-inter text-sm">
      {/* Panel Lateral */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold text-gray-800">Chat WhatsApp</h1>
              <p className="text-xs text-gray-500">Gestión de Conversaciones</p>
            </div>
            <div className="flex items-center space-x-2">
              <RefreshButton />
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
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? 'No se encontraron conversaciones' : 'No hay conversaciones activas'}
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => selectConversation(conversation)}
                className={`p-3 flex items-center space-x-3 cursor-pointer border-l-4 transition-all hover:bg-gray-50 ${
                  selectedConversation?.id === conversation.id 
                    ? 'bg-blue-50 border-blue-500' 
                    : 'border-transparent'
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-semibold">
                    <User className="w-6 h-6" />
                  </div>
                  {conversation.unread > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{conversation.unread}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 truncate">{conversation.contact.name}</h3>
                    <span className="text-xs text-gray-500">{conversation.timestamp}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-600 truncate">{conversation.lastMessage}</p>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {conversation.contact.phone}
                  </div>
                </div>
              </div>
            ))
          )}
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
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Área de Mensajes */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-gray-600 text-sm">Cargando mensajes...</p>
                  </div>
                </div>
              ) : currentMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">No hay mensajes en esta conversación</p>
                    <p className="text-gray-400 text-sm mt-1">Los mensajes aparecerán aquí</p>
                  </div>
                </div>
              ) : (
                currentMessages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`flex items-end gap-2 ${
                      message.sender === 'bot' ? 'justify-end' : 
                      message.sender === 'customer' ? 'justify-center' : 
                      'justify-start'
                    }`}
                  >
                    <div className={`max-w-lg px-4 py-2 rounded-lg shadow-sm ${
                      message.sender === 'bot' ? 'bg-blue-500 text-white rounded-br-none' :
                      message.sender === 'customer' ? 'bg-gray-200 text-gray-600 text-xs text-center w-full' :
                      'bg-white text-gray-800 rounded-bl-none border'
                    }`}>
                      <p className="text-sm break-words">{message.text}</p>
                      <div className="flex items-center justify-end gap-1 text-xs mt-1 opacity-75">
                        <span>{message.timestamp}</span>
                        {message.sender === 'bot' && <MessageStatus status={message.status} />}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Campo de Entrada */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                  <Paperclip className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Escribe un mensaje..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isLoadingMessages}
                  />
                  <button className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700">
                    <Smile className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || isLoadingMessages}
                  className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg font-medium">
                {conversations.length > 0 ? "Selecciona una conversación para comenzar" : "No hay conversaciones activas"}
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Los mensajes aparecerán cuando lleguen nuevas conversaciones
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;