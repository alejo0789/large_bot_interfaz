import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Phone, MoreVertical, Search, Paperclip, Smile, User, CheckCheck, Clock, ArrowLeft, Menu } from 'lucide-react';
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
  
  // --- NUEVOS ESTADOS PARA RESPONSIVE ---
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
  const messagesEndRef = useRef(null);

  // --- DETECTAR SI ES MÓVIL ---
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      console.log('📱 Verificando móvil:', { mobile, width: window.innerWidth });
      setIsMobile(mobile);
      if (mobile && selectedConversation) {
        setShowSidebar(false);
      } else if (!mobile) {
        setShowSidebar(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [selectedConversation]);

  // --- FUNCIONES DE API ---
  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Cargando conversaciones...');
      
      const response = await fetch(`${API_URL}/api/conversations`);
      if (!response.ok) throw new Error('Error al cargar conversaciones');
      
      const data = await response.json();
      
      // Fix para timestamps en conversaciones
      const fixedData = data.map(conv => {
        let timestampValue = conv.timestamp || conv.last_message_timestamp || conv.updated_at || new Date().toISOString();
        let formattedTime = 'Ahora';
        
        try {
          const date = new Date(timestampValue);
          if (!isNaN(date.getTime())) {
            formattedTime = date.toLocaleTimeString('es-CO', { 
              hour: '2-digit', 
              minute: '2-digit' 
            });
          }
        } catch (e) {
          console.warn('Error parseando fecha de conversación:', timestampValue);
        }

        return {
          ...conv,
          timestamp: formattedTime
        };
      });
      
      setConversations(fixedData);
      
      console.log(`✅ Conversaciones cargadas: ${fixedData.length}`);
      
      // En móvil, no seleccionar automáticamente una conversación
      if (fixedData.length > 0 && !isMobile) {
        await selectConversation(fixedData[0]);
      }
    } catch (error) {
      console.error("❌ Error al cargar conversaciones:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (phone) => {
    try {
      setIsLoadingMessages(true);
      console.log(`🔄 Cargando mensajes para ${phone}...`);
      
      const response = await fetch(`${API_URL}/api/conversations/${phone}/messages`);
      if (!response.ok) throw new Error('Error al cargar mensajes');
      
      const data = await response.json();
      
      const formattedMessages = data.map(msg => {
        // Fix para el timestamp - usar diferentes campos posibles
        let timestampValue = msg.timestamp || msg.created_at || new Date().toISOString();
        let formattedTime = 'Ahora';
        
        try {
          const date = new Date(timestampValue);
          if (!isNaN(date.getTime())) {
            formattedTime = date.toLocaleTimeString('es-CO', { 
              hour: '2-digit', 
              minute: '2-digit' 
            });
          }
        } catch (e) {
          console.warn('Error parseando fecha:', timestampValue);
        }

        return {
          id: msg.id || msg.whatsapp_id || Date.now(),
          text: msg.text || msg.text_content || msg.message_text || 'Sin contenido',
          sender: msg.sender || msg.sender_type || 'customer',
          timestamp: formattedTime,
          status: msg.status || 'delivered'
        };
      });
      
      setMessagesByConversation(prev => ({
        ...prev,
        [phone]: formattedMessages
      }));
      
      console.log(`✅ Mensajes cargados: ${formattedMessages.length}`);
    } catch (error) {
      console.error(`❌ Error al cargar mensajes para ${phone}:`, error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const selectConversation = async (conversation) => {
    console.log('🎯 Seleccionando conversación:', conversation.contact.phone);
    
    setSelectedConversation(conversation);
    
    // En móvil, ocultar la barra lateral cuando se selecciona una conversación
    if (isMobile) {
      setShowSidebar(false);
    }
    
    if (conversation.unread > 0) {
      await markConversationAsRead(conversation.contact.phone);
    }
    
    await fetchMessages(conversation.contact.phone);
  };

  const markConversationAsRead = async (phone) => {
    try {
      // Usar el endpoint correcto del backend
      await fetch(`${API_URL}/api/conversations/${phone}/mark-read`, { method: 'POST' });
      
      setConversations(prev => prev.map(conv => 
        conv.contact.phone === phone ? { ...conv, unread: 0 } : conv
      ));
    } catch (error) {
      console.error('❌ Error al marcar como leída:', error);
    }
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
    
    setConversations(prev => prev.map(conv => 
      conv.contact.phone === targetPhone 
        ? { ...conv, lastMessage: newMessage, timestamp: message.timestamp }
        : conv
    ));

    setNewMessage('');

    try {
      // Usar el endpoint correcto para enviar mensajes
      const response = await fetch(`${API_URL}/api/conversations/${targetPhone}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage })
      });

      if (!response.ok) throw new Error('Error al enviar mensaje');
      
      // Simular confirmación de envío
      setMessagesByConversation(prev => {
        const newState = { ...prev };
        if (newState[targetPhone]) {
          newState[targetPhone] = newState[targetPhone].map(msg => 
            msg.id === tempId 
              ? { ...msg, status: 'delivered' }
              : msg
          );
        }
        return newState;
      });
      
    } catch (error) {
      console.error('❌ Error al enviar mensaje:', error);
      // Marcar como fallido
      setMessagesByConversation(prev => {
        const newState = { ...prev };
        if (newState[targetPhone]) {
          newState[targetPhone] = newState[targetPhone].map(msg => 
            msg.id === tempId 
              ? { ...msg, status: 'failed', text: `${msg.text} ❌` }
              : msg
          );
        }
        return newState;
      });
    }
  };

  const refreshConversations = () => {
    fetchConversations();
  };

  // --- FUNCIÓN PARA REGRESAR EN MÓVIL ---
  const handleBackToConversations = () => {
    console.log('🔙 Regresando a lista de conversaciones');
    setSelectedConversation(null);
    if (isMobile) {
      setShowSidebar(true);
    }
  };

  // --- EFECTOS ---
  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    const onConnect = () => {
      console.log('✅ Conectado al servidor');
      setIsConnected(true);
    };

    const onDisconnect = () => {
      console.log('❌ Desconectado del servidor');
      setIsConnected(false);
    };

    const handleRealTimeMessage = (messageData) => {
      console.log('📨 Nuevo mensaje recibido:', messageData);
      
      const { phone, message_text, sender_type, contact_name, message, timestamp } = messageData;
      const isCurrentConversation = selectedConversation?.contact.phone === phone;
      
      // Fix para el timestamp
      let formattedTime = 'Ahora';
      try {
        if (timestamp) {
          const date = new Date(timestamp);
          if (!isNaN(date.getTime())) {
            formattedTime = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
          }
        } else {
          formattedTime = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        }
      } catch (e) {
        formattedTime = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      }
      
      const newMsg = {
        id: Date.now(),
        text: message || message_text || 'Sin contenido',
        sender: sender_type || 'customer',
        timestamp: formattedTime,
        status: 'delivered'
      };

      setMessagesByConversation(prev => ({
        ...prev,
        [phone]: [...(prev[phone] || []), newMsg]
      }));

      setConversations(prev => {
        const convIndex = prev.findIndex(c => c.contact.phone === phone);
        
        if (convIndex !== -1) {
          const updatedConv = {
            ...prev[convIndex],
            lastMessage: newMsg.text,
            timestamp: newMsg.timestamp,
            unread: isCurrentConversation ? prev[convIndex].unread : prev[convIndex].unread + 1
          };
          
          if (isCurrentConversation) {
            markConversationAsRead(phone);
          }
          
          const newConversations = [...prev];
          newConversations.splice(convIndex, 1);
          return [updatedConv, ...newConversations];
        } else {
          const contactName = contact_name || `Usuario ${phone.slice(-4)}`;
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

    const onMessageSent = (data) => {
      const { temp_id, message_id, status } = data;
      
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
  }, [selectedConversation]);

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

  // Obtener mensajes actuales
  const currentMessages = selectedConversation 
    ? messagesByConversation[selectedConversation.contact.phone] || []
    : [];

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

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* BARRA LATERAL DE CONVERSACIONES */}
      <div className={`${
        isMobile ? (showSidebar ? 'w-full' : 'hidden') : 'w-1/3'
      } bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}>
        
        {/* Header con indicador de conexión */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Chat Large + IA</h1>
                <div className="flex items-center space-x-2 text-sm opacity-90">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
                  <span>{isConnected ? 'Conectado' : 'Desconectado'}</span>
                </div>
              </div>
            </div>
            <RefreshButton />
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar conversaciones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Lista de conversaciones */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">No hay conversaciones</p>
              <p className="text-gray-400 text-sm mt-1">Las conversaciones aparecerán aquí cuando lleguen mensajes</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => selectConversation(conversation)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedConversation?.id === conversation.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {conversation.contact.name}
                      </h3>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="text-xs text-gray-500">{conversation.timestamp}</span>
                        {conversation.unread > 0 && (
                          <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                            {conversation.unread}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-1">{conversation.lastMessage}</p>
                    <p className="text-xs text-gray-400 mt-1">{conversation.contact.phone}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ÁREA DE CHAT PRINCIPAL */}
      <div className={`${
        isMobile ? (showSidebar ? 'hidden' : 'w-full') : 'flex-1'
      } flex flex-col bg-white transition-all duration-300`}>
        
        {selectedConversation ? (
          <>
            {/* Encabezado del Chat */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* Botón de regreso para móvil - MEJORADO */}
                {isMobile && (
                  <button
                    onClick={handleBackToConversations}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg mr-2 touch-button"
                    aria-label="Volver a conversaciones"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedConversation.contact.name}</h2>
                  <p className="text-xs text-gray-600">{selectedConversation.contact.phone}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg mobile-hidden">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Área de Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
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
                      message.sender === 'agent' ? 'justify-end' : 
                      message.sender === 'system' ? 'justify-center' : 
                      'justify-start'
                    }`}
                  >
                    <div className={`${
                      isMobile ? 'max-w-[85%]' : 'max-w-lg'
                    } px-4 py-2 rounded-lg shadow-sm ${
                      message.sender === 'agent' ? 'bg-blue-500 text-white rounded-br-none' :
                      message.sender === 'system' ? 'bg-gray-200 text-gray-600 text-xs text-center w-full' :
                      'bg-white text-gray-800 rounded-bl-none border'
                    }`}>
                      <p className="text-sm break-words">{message.text}</p>
                      <div className="flex items-center justify-end gap-1 text-xs mt-1 opacity-75">
                        <span>{message.timestamp}</span>
                        {message.sender === 'agent' && <MessageStatus status={message.status} />}
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
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg hidden sm:block">
                  <Paperclip className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Escribe un mensaje..."
                    className={`w-full px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      isMobile ? 'text-base' : 'text-sm'
                    }`}
                    disabled={isLoadingMessages}
                  />
                  <button className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 hidden sm:block">
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
              {/* Botón para mostrar conversaciones en móvil */}
              {isMobile && conversations.length > 0 && (
                <button
                  onClick={() => setShowSidebar(true)}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Ver conversaciones
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;