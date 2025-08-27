import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Phone, MoreVertical, Search, Paperclip, Smile, User, CheckCheck, Clock, ArrowLeft, Menu, Bot, UserCheck } from 'lucide-react';
import { io } from 'socket.io-client';
import './mobile-styles.css';

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
  
  // --- ESTADOS PARA RESPONSIVE ---
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // ✅ ESTADO DE IA POR CONVERSACIÓN (no global)
  const [aiStatesByPhone, setAiStatesByPhone] = useState({});
  
  const messagesEndRef = useRef(null);

  // --- FUNCIÓN PARA FORMATEAR TIMESTAMPS CORRECTAMENTE ---
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    
    try {
      // Si ya viene formateado como "HH:MM", devolverlo tal como está
      if (typeof timestamp === 'string' && timestamp.match(/^\d{1,2}:\d{2}$/)) {
        return timestamp;
      }
      
      // Si es un string de fecha ISO o número timestamp
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('es-CO', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
      
      return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formateando timestamp:', error);
      return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }
  };

  // --- DETECCIÓN DE PANTALLA MÓVIL ---
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setShowSidebar(!mobile); // En móvil, inicialmente ocultar sidebar
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // --- CONEXIÓN WEBSOCKET ---
  useEffect(() => {
    const handleConnect = () => {
      console.log('🟢 Conectado a Socket.IO');
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      console.log('🔴 Desconectado de Socket.IO');
      setIsConnected(false);
    };

    const handleNewMessage = (messageData) => {
      console.log('📨 Nuevo mensaje recibido:', messageData);
      
      const formattedMessage = {
        id: messageData.whatsapp_id || Date.now(),
        text: messageData.message || messageData.text,
        sender: messageData.sender_type || messageData.sender || 'customer',
        timestamp: formatTimestamp(messageData.timestamp),
        status: 'delivered'
      };

      // Actualizar mensajes
      setMessagesByConversation(prev => ({
        ...prev,
        [messageData.phone]: [...(prev[messageData.phone] || []), formattedMessage]
      }));

      // Actualizar conversaciones con el nuevo mensaje
      setConversations(prev => prev.map(conv => 
        conv.contact.phone === messageData.phone 
          ? {
              ...conv, 
              lastMessage: formattedMessage.text,
              timestamp: formattedMessage.timestamp,
              unread: conv.contact.phone === selectedConversation?.contact.phone ? 0 : (conv.unread || 0) + 1
            }
          : conv
      ));
    };

    const handleConversationStateChanged = (data) => {
      console.log('🔄 Estado de conversación cambiado:', data);
      setAiStatesByPhone(prev => ({
        ...prev,
        [data.phone]: data.state === 'ai_active'
      }));
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('new-message', handleNewMessage);
    socket.on('conversation-state-changed', handleConversationStateChanged);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('new-message', handleNewMessage);
      socket.off('conversation-state-changed', handleConversationStateChanged);
    };
  }, [selectedConversation]);

  // --- SCROLL AUTOMÁTICO ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesByConversation, selectedConversation]);

  // --- CARGAR DATOS INICIALES ---
  useEffect(() => {
    fetchConversations();
  }, []);

  // --- FUNCIÓN PARA CARGAR CONVERSACIONES (✅ ALINEADA CON BACKEND) ---
  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Cargando conversaciones...');
      
      const response = await fetch(`${API_URL}/api/conversations`);
      if (!response.ok) throw new Error('Error al cargar conversaciones');
      
      const data = await response.json();
      
      // ✅ Usar la estructura exacta que devuelve el backend
      setConversations(data);
      
      console.log(`✅ Conversaciones cargadas: ${data.length}`);
      
      // En móvil, no seleccionar automáticamente una conversación
      if (data.length > 0 && !isMobile) {
        await selectConversation(data[0]);
      }
    } catch (error) {
      console.error("❌ Error al cargar conversaciones:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- FUNCIÓN PARA CARGAR MENSAJES (✅ ALINEADA CON BACKEND) ---
  const fetchMessages = async (phone) => {
    try {
      setIsLoadingMessages(true);
      console.log(`🔄 Cargando mensajes para ${phone}...`);
      
      const response = await fetch(`${API_URL}/api/conversations/${phone}/messages`);
      if (!response.ok) throw new Error('Error al cargar mensajes');
      
      const data = await response.json();
      
      // ✅ Usar la estructura exacta que devuelve el backend
      setMessagesByConversation(prev => ({
        ...prev,
        [phone]: data
      }));
      
      console.log(`✅ Mensajes cargados: ${data.length}`, data);
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

  // --- FUNCIÓN PARA MARCAR COMO LEÍDO (✅ USANDO ENDPOINT CORRECTO) ---
  const markConversationAsRead = async (phone) => {
    try {
      await fetch(`${API_URL}/api/conversations/${phone}/mark-read`, { method: 'POST' });
      
      setConversations(prev => prev.map(conv => 
        conv.contact.phone === phone ? { ...conv, unread: 0 } : conv
      ));
    } catch (error) {
      console.error('❌ Error al marcar como leída:', error);
    }
  };

  // --- FUNCIÓN DE ENVÍO (✅ USANDO ENDPOINT CORRECTO DEL BACKEND) ---
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const tempId = Date.now();
    const targetPhone = selectedConversation.contact.phone;
    const contactName = selectedConversation.contact.name;
    
    // ✅ OBTENER ESTADO DE IA PARA ESTA CONVERSACIÓN ESPECÍFICA
    const currentAIState = aiStatesByPhone[targetPhone] ?? true; // default: IA activa

    const message = {
      id: tempId,
      text: newMessage,
      sender: 'agent',
      timestamp: formatTimestamp(new Date()),
      status: 'sending'
    };
    
    // Añadir mensaje al UI inmediatamente
    setMessagesByConversation(prev => ({
      ...prev,
      [targetPhone]: [...(prev[targetPhone] || []), message]
    }));
    
    // Actualizar última conversación
    setConversations(prev => prev.map(conv => 
      conv.contact.phone === targetPhone 
        ? { ...conv, lastMessage: newMessage, timestamp: message.timestamp }
        : conv
    ));

    const messageToSend = newMessage;
    setNewMessage('');

    try {
      // ✅ USAR EL ENDPOINT CORRECTO SEGÚN EL BACKEND
      console.log(`📤 Enviando mensaje a ${contactName} (${targetPhone}): ${messageToSend}`);
      
      const response = await fetch(`${API_URL}/api/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: targetPhone,        // ✅ Campo correcto según backend
          message: messageToSend,    // ✅ Campo correcto según backend  
          name: contactName,         // ✅ Campo correcto según backend
          temp_id: tempId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al enviar mensaje');
      }
      
      const result = await response.json();
      console.log('✅ Respuesta del servidor:', result);
      
      // Confirmar entrega en el UI
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
              ? { ...msg, status: 'failed' }
              : msg
          );
        }
        return newState;
      });
    }
  };

  // --- FUNCIÓN DE TOGGLE SIMPLE USANDO TU ENDPOINT EXISTENTE ---
  const toggleAIForConversation = async (phone) => {
    if (!phone) return;
    
    const currentState = aiStatesByPhone[phone] ?? true; // default: IA activa
    const newState = !currentState;
    
    try {
      // ✅ USAR TU ENDPOINT EXISTENTE /toggle-ai
      const response = await fetch(`${API_URL}/api/conversations/${phone}/toggle-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ai_enabled: newState 
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Actualizar estado local inmediatamente
        setAiStatesByPhone(prev => ({
          ...prev,
          [phone]: newState
        }));
        
        console.log(`✅ ${newState ? 'IA activada' : 'Modo manual activado'} para ${phone}:`, result);
      } else {
        const errorData = await response.json();
        console.error('❌ Error en respuesta del servidor:', errorData);
      }
    } catch (error) {
      console.error('❌ Error cambiando estado de IA:', error);
      // Revertir el cambio en caso de error
      setAiStatesByPhone(prev => ({
        ...prev,
        [phone]: currentState
      }));
    }
  };

  // --- CONVERSACIONES FILTRADAS ---
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    
    return conversations.filter(conv =>
      conv.contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.contact.phone?.includes(searchQuery) ||
      conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  // --- MANEJO DE ENVÍO CON ENTER ---
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // --- RENDER ---
  return (
    <div className={`${isMobile ? 'h-screen flex flex-col' : 'flex h-screen bg-gray-100'}`}>
      {/* Sidebar de conversaciones */}
      <div className={`${
        isMobile 
          ? `fixed inset-y-0 left-0 z-50 w-full bg-white transform transition-transform duration-300 ${
              showSidebar ? 'translate-x-0' : '-translate-x-full'
            }`
          : 'w-80'
      } bg-white border-r border-gray-200 flex flex-col`}>
        
        {/* Header del Sidebar */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-800">
              Conversaciones
            </h1>
            <div className="flex items-center space-x-2">
              {/* Indicador de conexión */}
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">
                {isConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>
          
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar conversaciones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Lista de conversaciones */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              Cargando conversaciones...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? 'No se encontraron conversaciones' : 'No hay conversaciones'}
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const isSelected = selectedConversation?.id === conversation.id;
              const currentAIState = aiStatesByPhone[conversation.contact.phone] ?? true;
              
              return (
                <div
                  key={conversation.id}
                  onClick={() => selectConversation(conversation)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                        <User className="w-6 h-6" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {conversation.contact.name}
                        </h3>
                        <div className="flex items-center space-x-2">
                          {/* Indicador de estado más claro */}
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            currentAIState 
                              ? 'bg-green-100 text-green-700 border border-green-200' 
                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}>
                            {currentAIState ? '🤖 IA' : '👤 Manual'}
                          </div>
                          <span className="text-xs text-gray-500">
                            {conversation.timestamp}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 truncate mt-1">
                        {conversation.lastMessage}
                      </p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          {conversation.contact.phone}
                        </span>
                        {conversation.unread > 0 && (
                          <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[1rem] text-center">
                            {conversation.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Área principal de chat */}
      <div className={`${
        isMobile 
          ? `flex-1 flex flex-col bg-gray-50 ${showSidebar ? 'hidden' : ''}`
          : 'flex-1 flex flex-col'
      }`}>
        {selectedConversation ? (
          <>
            {/* Header del chat - MOBILE OPTIMIZADO */}
            <div className={`bg-white border-b border-gray-200 ${
              isMobile 
                ? 'fixed top-0 left-0 right-0 z-10 px-4 py-3 h-16'
                : 'p-4'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {isMobile && (
                    <button
                      onClick={() => setShowSidebar(true)}
                      className="p-2 hover:bg-gray-100 rounded-lg -ml-2"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                  )}
                  
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                      <User className="w-5 h-5" />
                    </div>
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <h2 className={`font-semibold text-gray-900 truncate ${
                      isMobile ? 'text-base' : 'text-lg'
                    }`}>
                      {selectedConversation.contact.name}
                    </h2>
                    <p className={`text-gray-500 truncate ${
                      isMobile ? 'text-xs' : 'text-sm'
                    }`}>
                      {selectedConversation.contact.phone}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Toggle Switch de IA/Manual - COMPACTO EN MÓVIL */}
                  <div className="flex items-center space-x-2">
                    {!isMobile && (
                      <span className={`text-sm font-medium transition-colors ${
                        aiStatesByPhone[selectedConversation.contact.phone] ?? true 
                          ? 'text-gray-400' 
                          : 'text-blue-600'
                      }`}>
                        Manual
                      </span>
                    )}
                    
                    <button
                      onClick={() => toggleAIForConversation(selectedConversation.contact.phone)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        aiStatesByPhone[selectedConversation.contact.phone] ?? true
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}
                      aria-pressed={aiStatesByPhone[selectedConversation.contact.phone] ?? true}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          aiStatesByPhone[selectedConversation.contact.phone] ?? true
                            ? 'translate-x-6'
                            : 'translate-x-1'
                        }`}
                      />
                    </button>
                    
                    {!isMobile && (
                      <span className={`text-sm font-medium transition-colors ${
                        aiStatesByPhone[selectedConversation.contact.phone] ?? true 
                          ? 'text-green-600' 
                          : 'text-gray-400'
                      }`}>
                        IA
                      </span>
                    )}
                  </div>

                  {!isMobile && (
                    <>
                      <button className="p-2 hover:bg-gray-100 rounded-lg">
                        <Phone className="w-5 h-5 text-gray-600" />
                      </button>
                      <button className="p-2 hover:bg-gray-100 rounded-lg">
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Área de mensajes - MOBILE OPTIMIZADO */}
            <div className={`flex-1 overflow-y-auto space-y-4 ${
              isMobile 
                ? 'px-4 py-4 mt-16 mb-20 bg-gray-50'
                : 'p-4'
            }`} style={isMobile ? { 
              WebkitOverflowScrolling: 'touch',
              height: 'calc(100vh - 140px)', 
              overflowY: 'auto' 
            } : {}}>
              {isLoadingMessages ? (
                <div className="flex justify-center items-center h-32">
                  <div className="text-gray-500">Cargando mensajes...</div>
                </div>
              ) : (
                messagesByConversation[selectedConversation.contact.phone]?.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`${isMobile ? 'max-w-[280px]' : 'max-w-xs lg:max-w-md'} px-4 py-2 rounded-lg ${
                        message.sender === 'agent'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-900 border border-gray-200'
                      }`}
                    >
                      <p className={`${isMobile ? 'text-sm' : 'text-sm'}`}>{message.text}</p>
                      <div className="flex items-center justify-end space-x-1 mt-1">
                        <span className={`text-xs ${
                          message.sender === 'agent' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {message.timestamp}
                        </span>
                        {message.sender === 'agent' && (
                          <div className="flex">
                            {message.status === 'sending' && <Clock className="w-3 h-3 text-blue-200" />}
                            {message.status === 'delivered' && <CheckCheck className="w-3 h-3 text-blue-200" />}
                            {message.status === 'failed' && <span className="text-red-300">❌</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Área de entrada de mensaje - MOBILE OPTIMIZADO */}
            <div className={`bg-white border-t border-gray-200 ${
              isMobile 
                ? 'fixed bottom-0 left-0 right-0 p-3 z-10'
                : 'p-4'
            }`}>
              <div className="flex items-center space-x-2">
                {!isMobile && (
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <Paperclip className="w-5 h-5 text-gray-600" />
                  </button>
                )}
                
                <div className="flex-1">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Escribe un mensaje..."
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      isMobile ? 'text-base' : 'text-sm'
                    }`}
                    style={{ fontSize: isMobile ? '16px' : '14px' }} // Previene zoom en iOS
                  />
                </div>
                
                {!isMobile && (
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <Smile className="w-5 h-5 text-gray-600" />
                  </button>
                )}
                
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Selecciona una conversación
              </h3>
              <p className="text-gray-500">
                Elige una conversación para comenzar a chatear
              </p>
              {isMobile && (
                <button
                  onClick={() => setShowSidebar(true)}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
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