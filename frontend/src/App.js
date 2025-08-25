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
      if (typeof timestamp === 'string' && timestamp.match(/^\d{2}:\d{2}$/)) {
        return timestamp;
      }
      
      // Intentar convertir timestamp a fecha
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      }
      
      // Si falla, usar hora actual
      return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.warn('Error formateando timestamp:', timestamp, error);
      return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }
  };

  // --- DETECTAR SI ES MÓVIL ---
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      console.log('📱 Verificando móvil:', { 
        mobile, 
        width: window.innerWidth, 
        height: window.innerHeight,
        orientation: window.orientation 
      });
      setIsMobile(mobile);
      
      // En móvil, mostrar sidebar si no hay conversación seleccionada
      if (mobile) {
        if (!selectedConversation) {
          setShowSidebar(true);
        } else {
          setShowSidebar(false);
        }
      } else {
        // En desktop, siempre mostrar sidebar
        setShowSidebar(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', () => {
      // Esperar un poco después del cambio de orientación
      setTimeout(checkMobile, 100);
    });
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, [selectedConversation]);

  // --- FUNCIONES DE API ---
  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Cargando conversaciones...');
      
      const response = await fetch(`${API_URL}/api/conversations`);
      if (!response.ok) throw new Error('Error al cargar conversaciones');
      
      const data = await response.json();
      
      // ✅ FIX PARA TIMESTAMPS - usar función correcta
      const fixedData = data.map(conv => {
        const timestampValue = conv.last_message_timestamp || conv.timestamp || conv.updated_at;
        const formattedTime = formatTimestamp(timestampValue);

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
      console.log('📦 Datos recibidos del backend:', data);
      
      const formattedMessages = data.map(msg => {
        console.log('🔍 Procesando mensaje:', msg);
        
        // ✅ FIX PARA TIMESTAMPS - usar función correcta
        const formattedTime = formatTimestamp(msg.timestamp);

        // Fix para el texto - según el backend usa 'text_content'
        const messageText = msg.text || msg.text_content || msg.message || msg.message_text || 'Sin contenido';
        
        console.log('✅ Mensaje procesado:', { 
          id: msg.id, 
          text: messageText, 
          sender: msg.sender,
          timestamp: formattedTime 
        });

        return {
          id: msg.id || msg.whatsapp_id || Date.now(),
          text: messageText,
          sender: msg.sender || msg.sender_type || 'customer',
          timestamp: formattedTime,
          status: msg.status || 'delivered'
        };
      });
      
      setMessagesByConversation(prev => ({
        ...prev,
        [phone]: formattedMessages
      }));
      
      console.log(`✅ Mensajes cargados: ${formattedMessages.length}`, formattedMessages);
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

  // --- FUNCIÓN DE ENVÍO ACTUALIZADA ---
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
      // ✅ USAR EL ENDPOINT CORRECTO: /api/send-message
      console.log(`📤 Enviando mensaje a ${contactName} (${targetPhone}): ${messageToSend} - IA: ${currentAIState ? 'ACTIVA' : 'DESACTIVADA'}`);
      
      const response = await fetch(`${API_URL}/api/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: targetPhone,              // Campo requerido por el backend
          message: messageToSend,          // Campo requerido por el backend
          name: contactName,    // Nombre del contacto
          temp_id: tempId,
          sender: 'agent',
          ai_enabled: currentAIState    // ✅ Estado de IA para esta conversación específica
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

  // ✅ FUNCIONES DE CONTROL DE IA POR CONVERSACIÓN
  const toggleAIForConversation = async (phone) => {
    if (!phone) return;
    
    const currentState = aiStatesByPhone[phone] ?? true; // default: IA activa
    const newState = !currentState;
    
    // Actualizar estado local para esta conversación específica
    setAiStatesByPhone(prev => ({
      ...prev,
      [phone]: newState
    }));
    
    // Opcional: Notificar al backend del cambio de estado para esta conversación
    try {
      await fetch(`${API_URL}/api/conversations/${phone}/toggle-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_enabled: newState })
      });
      console.log(`🤖 IA ${newState ? 'activada' : 'desactivada'} para conversación: ${phone}`);
    } catch (error) {
      console.warn('⚠️ No se pudo sincronizar el estado de IA con el backend:', error);
    }
  };

  // --- EFECTOS ---
  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      console.log('✅ Conectado al servidor');
    };

    const onDisconnect = () => {
      setIsConnected(false);
      console.log('❌ Desconectado del servidor');
    };

    const handleRealTimeMessage = (messageData) => {
      console.log('📨 Nuevo mensaje recibido:', messageData);
      
      const { phone, message_text, sender_type, contact_name, message, timestamp, text_content } = messageData;
      const isCurrentConversation = selectedConversation?.contact.phone === phone;
      
      // ✅ FIX PARA TIMESTAMP - usar función correcta
      const formattedTime = formatTimestamp(timestamp);
      
      // Fix para el texto del mensaje - intentar varios campos
      const messageText = message || message_text || text_content || 'Sin contenido';
      console.log('📝 Texto del mensaje extraído:', messageText);
      
      const newMsg = {
        id: Date.now(),
        text: messageText,
        sender: sender_type || 'customer',
        timestamp: formattedTime,
        status: 'delivered'
      };

      console.log('✅ Mensaje formateado:', newMsg);

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

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('new-message', handleRealTimeMessage);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new-message', handleRealTimeMessage);
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
      className="p-2 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors"
      title="Refrescar conversaciones"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  );

  // ✅ COMPONENTE SELECTOR DE IA POR CONVERSACIÓN
  const AIToggle = () => {
    if (!selectedConversation) return null;
    
    const phone = selectedConversation.contact.phone;
    const isAIEnabled = aiStatesByPhone[phone] ?? true; // default: IA activa
    
    return (
      <div className="flex items-center space-x-2">
        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
          isAIEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}>
          {isAIEnabled ? <Bot className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
          <span className="text-sm font-medium">
            {isAIEnabled ? 'IA Activa' : 'Solo Manual'}
          </span>
        </div>
        <button
          onClick={() => toggleAIForConversation(phone)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
            isAIEnabled ? 'bg-green-600' : 'bg-gray-400'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
              isAIEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    );
  };

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
        <div className="flex-1 conversations-container">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">No hay conversaciones</p>
              <p className="text-gray-400 text-sm mt-1">Las conversaciones aparecerán aquí cuando lleguen mensajes</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const phone = conversation.contact.phone;
              const isAIActive = aiStatesByPhone[phone] ?? true;
              
              return (
                <div
                  key={conversation.id}
                  onClick={() => selectConversation(conversation)}
                  className={`conversation-item touchable ${
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
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-400">{conversation.contact.phone}</p>
                        {/* ✅ INDICADOR DE ESTADO IA EN CADA CONVERSACIÓN */}
                        <div className={`px-2 py-0.5 rounded-full text-xs ${
                          isAIActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isAIActive ? '🤖 IA' : '👤 Manual'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ÁREA DE CHAT PRINCIPAL */}
      <div className={`${
        isMobile ? (showSidebar ? 'hidden' : 'w-full') : 'flex-1'
      } flex flex-col bg-white transition-all duration-300 ${isMobile ? 'mobile-full' : ''}`}>
        
        {selectedConversation ? (
          <>
            {/* Encabezado del Chat con Selector de IA */}
            <div className={`${
              isMobile ? 'mobile-header' : 'bg-white border-b border-gray-200 p-4'
            } flex items-center justify-between`}>
              <div className="flex items-center space-x-3 p-4">
                {/* Botón de regreso SIEMPRE visible en móvil */}
                <button
                  onClick={handleBackToConversations}
                  className={`mobile-button touchable ${
                    isMobile ? 'block' : 'hidden'
                  } bg-gray-100 rounded-lg`}
                  aria-label="Volver a conversaciones"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-700" />
                </button>
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedConversation.contact.name}</h2>
                  <p className="text-xs text-gray-600">{selectedConversation.contact.phone}</p>
                </div>
              </div>
              
              {/* ✅ SELECTOR DE IA POR CONVERSACIÓN EN EL HEADER */}
              <div className="flex items-center space-x-2 p-4">
                <AIToggle />
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg desktop-only">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Área de Mensajes */}
            <div className={`${
              isMobile ? 'mobile-content messages-container' : 'flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50'
            }`}>
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
                currentMessages.map((message) => {
                  return (
                    <div 
                      key={message.id} 
                      className={`flex items-end gap-2 mb-4 ${
                        message.sender === 'agent' ? 'justify-end' : 
                        message.sender === 'bot' ? 'justify-end' : 
                        message.sender === 'system' ? 'justify-center' : 
                        'justify-start'
                      }`}
                    >
                      <div className={`message-bubble px-4 py-2 rounded-lg shadow-sm ${
                        message.sender === 'agent' ? 'bg-green-500 text-white rounded-br-none' :
                        message.sender === 'bot' ? 'bg-blue-500 text-white rounded-br-none' :
                        message.sender === 'system' ? 'bg-gray-200 text-gray-600 text-xs text-center w-full' :
                        'bg-white text-gray-800 rounded-bl-none border'
                      }`}>
                        <p className="text-sm break-words">
                          {message.text || '[Sin contenido]'}
                        </p>
                        <div className="flex items-center justify-end gap-1 text-xs mt-1 opacity-75">
                          <span>{message.timestamp || 'Sin hora'}</span>
                          {(message.sender === 'agent' || message.sender === 'bot') && <MessageStatus status={message.status} />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Campo de Entrada */}
            <div className={`${
              isMobile ? 'mobile-input-area' : 'bg-white border-t border-gray-200 p-4'
            }`}>
              <div className="flex items-center space-x-3">
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg desktop-only">
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
                  <button className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 desktop-only">
                    <Smile className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || isLoadingMessages}
                  className="mobile-button bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  className="mt-4 mobile-button bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors px-4 py-2"
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