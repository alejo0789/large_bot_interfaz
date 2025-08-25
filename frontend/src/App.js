import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Phone, MoreVertical, Search, Paperclip, Smile, User, CheckCheck, Clock, ArrowLeft, Menu } from 'lucide-react';
import { io } from 'socket.io-client';
import './mobile-styles.css';

// --- CONFIGURACIÓN ---
const SOCKET_URL = "https://backendtest-production-50b5.up.railway.app"|| 'http://localhost:4000';
const API_URL = "https://backendtest-production-50b5.up.railway.app" || 'http://localhost:4000';
const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnectionAttempts: 5
});

const App = () => {
  // --- ESTADOS PRINCIPALES ---
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messagesByConversation, setMessagesByConversation] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
  // ✅ ESTADO PARA CONTROLES IA/AGENTE
  const [conversationStates, setConversationStates] = useState({});
  
  const messagesEndRef = useRef(null);

  // --- DETECCIÓN MÓVIL ---
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      if (mobile) {
        setShowSidebar(!selectedConversation);
      } else {
        setShowSidebar(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', () => setTimeout(checkMobile, 100));
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, [selectedConversation]);

  // --- FUNCIONES DE API ---
  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/conversations`);
      if (!response.ok) throw new Error('Error al cargar conversaciones');
      
      const data = await response.json();
      
      const fixedData = data.map(conv => {
        let timestampValue = conv.timestamp || conv.last_message_timestamp || conv.updated_at || new Date().toISOString();
        let formattedTime = 'Ahora';
        
        try {
          const date = new Date(timestampValue);
          if (!isNaN(date.getTime())) {
            formattedTime = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
          }
        } catch (e) {
          console.warn('Error parseando fecha:', timestampValue);
        }

        return { ...conv, timestamp: formattedTime };
      });
      
      setConversations(fixedData);
    } catch (error) {
      console.error('❌ Error al cargar conversaciones:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (phone) => {
    try {
      setIsLoadingMessages(true);
      const response = await fetch(`${API_URL}/api/conversations/${phone}/messages`);
      const data = await response.json();
      
      const formattedMessages = data.map((msg, index) => {
        let formattedTime = 'Sin hora';
        
        try {
          if (msg.timestamp) {
            if (typeof msg.timestamp === 'string' && msg.timestamp.includes(':')) {
              formattedTime = msg.timestamp;
            } else {
              const date = new Date(msg.timestamp);
              if (!isNaN(date.getTime())) {
                formattedTime = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
              }
            }
          }
        } catch (e) {
          console.warn(`Error procesando timestamp para mensaje ${index}:`, e);
        }
        
        const messageText = msg.text || msg.text_content || msg.message || msg.message_text || 'Sin contenido';

        return {
          id: msg.id || msg.whatsapp_id || Date.now(),
          text: messageText,
          sender: msg.sender || msg.sender_type || 'customer',
          timestamp: formattedTime,
          status: msg.status || 'delivered'
        };
      });
      
      setMessagesByConversation(prev => ({ ...prev, [phone]: formattedMessages }));
    } catch (error) {
      console.error(`❌ Error al cargar mensajes para ${phone}:`, error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const selectConversation = async (conversation) => {
    setSelectedConversation(conversation);
    
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
    ).sort((a, b) => {
      const timeA = new Date(`1970-01-01 ${a.timestamp || '00:00'}`);
      const timeB = new Date(`1970-01-01 ${b.timestamp || '00:00'}`);
      return timeB - timeA;
    }));

    const messageToSend = newMessage;
    setNewMessage('');
  
    try {
      const response = await fetch(`${API_URL}/api/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: targetPhone,
          message: messageToSend,
          temp_id: tempId,
          agent_id: 'agent'
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.conversation_state) {
          setConversationStates(prev => ({ ...prev, [targetPhone]: result.conversation_state }));
        }
        
        setMessagesByConversation(prev => {
          const newState = { ...prev };
          if (newState[targetPhone]) {
            newState[targetPhone] = newState[targetPhone].map(msg => 
              msg.id === tempId ? { ...msg, status: 'delivered' } : msg
            );
          }
          return newState;
        });
      } else {
        throw new Error('Error en la respuesta del servidor');
      }
    } catch (error) {
      console.error('❌ Error al enviar mensaje:', error);
      setMessagesByConversation(prev => {
        const newState = { ...prev };
        if (newState[targetPhone]) {
          newState[targetPhone] = newState[targetPhone].map(msg => 
            msg.id === tempId ? { ...msg, status: 'failed', text: `${msg.text} ❌` } : msg
          );
        }
        return newState;
      });
    }
  };

  // ✅ FUNCIONES PARA CONTROLES IA/AGENTE
  const takeConversationAsAgent = async (phone) => {
    try {
      const response = await fetch(`${API_URL}/api/conversations/${phone}/take-by-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: 'frontend_agent_001' })
      });

      if (response.ok) {
        setConversationStates(prev => ({ ...prev, [phone]: 'agent_active' }));
      }
    } catch (error) {
      console.error('❌ Error:', error);
    }
  };

  const reactivateAI = async (phone) => {
    try {
      const response = await fetch(`${API_URL}/api/conversations/${phone}/activate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        setConversationStates(prev => ({ ...prev, [phone]: 'ai_active' }));
      }
    } catch (error) {
      console.error('❌ Error:', error);
    }
  };

  const handleBackToConversations = () => {
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
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const handleRealTimeMessage = (messageData) => {
      const { phone, message_text, sender_type, contact_name, message, timestamp, text_content } = messageData;
      const isCurrentConversation = selectedConversation?.contact.phone === phone;
      
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
      
      const messageText = message || message_text || text_content || 'Sin contenido';
      
      const newMsg = {
        id: Date.now(),
        text: messageText,
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
            unread: isCurrentConversation ? 0 : (prev[convIndex].unread || 0) + 1
          };
          
          const newConversations = [...prev];
          newConversations.splice(convIndex, 1);
          return [updatedConv, ...newConversations];
        } else {
          const newConv = {
            id: phone,
            contact: {
              name: contact_name || `Usuario ${phone.slice(-4)}`,
              phone: phone
            },
            lastMessage: newMsg.text,
            timestamp: newMsg.timestamp,
            unread: isCurrentConversation ? 0 : 1
          };
          
          return [newConv, ...prev];
        }
      });
    };

    const handleStateChange = (data) => {
      setConversationStates(prev => ({ ...prev, [data.phone]: data.state }));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('new-message', handleRealTimeMessage);
    socket.on('conversation-state-changed', handleStateChange);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new-message', handleRealTimeMessage);
      socket.off('conversation-state-changed', handleStateChange);
    };
  }, [selectedConversation]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesByConversation, selectedConversation]);

  // --- DATOS FILTRADOS ---
  const filteredConversations = useMemo(() => {
    return conversations.filter(conversation =>
      conversation.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.contact.phone.includes(searchQuery) ||
      conversation.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  const currentMessages = selectedConversation 
    ? messagesByConversation[selectedConversation.contact.phone] || []
    : [];

  // --- COMPONENTES ---
  const MessageStatus = ({ status }) => {
    switch (status) {
      case 'sending': return <Clock className="w-3 h-3" />;
      case 'delivered': return <CheckCheck className="w-3 h-3" />;
      case 'failed': return <span className="text-red-500">❌</span>;
      default: return null;
    }
  };

  const ConversationControls = ({ conversation }) => {
    const currentState = conversationStates[conversation.contact.phone] || 'ai_active';
    const isAgentActive = currentState === 'agent_active';
    
    return (
      <div className="flex items-center gap-1">
        <div className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
          isAgentActive ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
        }`}>
          <span>{isAgentActive ? '👤' : '🤖'}</span>
          <span className="hidden sm:inline">{isAgentActive ? 'Agente' : 'IA'}</span>
        </div>
        
        {!isAgentActive ? (
          <button
            onClick={() => takeConversationAsAgent(conversation.contact.phone)}
            className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
          >
            Tomar
          </button>
        ) : (
          <button
            onClick={() => reactivateAI(conversation.contact.phone)}
            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
          >
            IA
          </button>
        )}
      </div>
    );
  };

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

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* SIDEBAR */}
      <div className={`${
        isMobile ? (showSidebar ? 'w-full' : 'hidden') : 'w-1/3'
      } bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Chat Large + IA</h1>
                <div className="flex items-center space-x-2 text-sm opacity-90">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span>{isConnected ? 'Conectado' : 'Desconectado'}</span>
                </div>
              </div>
            </div>
            <button
              onClick={fetchConversations}
              className="p-2 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors"
            >
              <Menu className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Búsqueda */}
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
            filteredConversations.map((conversation) => (
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
                      <ConversationControls conversation={conversation} />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className={`${
        isMobile ? (showSidebar ? 'hidden' : 'w-full') : 'flex-1'
      } flex flex-col bg-white transition-all duration-300 ${isMobile ? 'mobile-full' : ''}`}>
        
        {selectedConversation ? (
          <>
            {/* Header del chat */}
            <div className={`${
              isMobile ? 'mobile-header' : 'bg-white border-b border-gray-200 p-4'
            } flex items-center justify-between`}>
              <div className="flex items-center space-x-3 p-4">
                <button
                  onClick={handleBackToConversations}
                  className={`mobile-button touchable ${isMobile ? 'block' : 'hidden'} bg-gray-100 rounded-lg`}
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
              <div className="flex items-center space-x-2 p-4">
                <ConversationControls conversation={selectedConversation} />
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg desktop-only">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mensajes */}
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
                currentMessages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`flex items-end gap-2 mb-4 ${
                      message.sender === 'bot' ? 'justify-end' : 
                      message.sender === 'system' ? 'justify-center' : 
                      'justify-start'
                    }`}
                  >
                    <div className={`message-bubble px-4 py-2 rounded-lg shadow-sm ${
                      message.sender === 'bot' ? 'bg-blue-500 text-white rounded-br-none' :
                      message.sender === 'system' ? 'bg-gray-200 text-gray-600 text-xs text-center w-full' :
                      'bg-white text-gray-800 rounded-bl-none border'
                    }`}>
                      <p className="text-sm break-words">{message.text || '[Sin contenido]'}</p>
                      <div className="flex items-center justify-end gap-1 text-xs mt-1 opacity-75">
                        <span>{message.timestamp || 'Sin hora'}</span>
                        {message.sender === 'agent' && <MessageStatus status={message.status} />}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
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