import React, { useState, useEffect, useRef } from 'react';
import { Send, Phone, MoreVertical, Search, Paperclip, Smile, User, MessageCircle, Settings, Bell, Shield, Wifi, WifiOff } from 'lucide-react';

const App = () => {
  // Variables de entorno para Railway
  const N8N_WEBHOOK_URL = process.env.REACT_APP_N8N_WEBHOOK_URL || 'https://your-n8n-instance.com/webhook';
  const N8N_API_KEY = process.env.REACT_APP_N8N_API_KEY || 'demo-key';
  
  const [conversations, setConversations] = useState([
    {
      id: 1,
      contact: { name: 'Juan Pérez', phone: '+57 300 123 4567', avatar: null },
      lastMessage: 'Hola, necesito información sobre sus servicios',
      timestamp: '10:30 AM',
      unread: 2,
      status: 'active'
    },
    {
      id: 2,
      contact: { name: 'María González', phone: '+57 301 987 6543', avatar: null },
      lastMessage: 'Gracias por la información',
      timestamp: '9:15 AM',
      unread: 0,
      status: 'resolved'
    },
    {
      id: 3,
      contact: { name: 'Carlos Rodríguez', phone: '+57 302 555 1234', avatar: null },
      lastMessage: '¿Cuándo pueden hacer la instalación?',
      timestamp: 'Ayer',
      unread: 1,
      status: 'pending'
    }
  ]);

  const [selectedConversation, setSelectedConversation] = useState(conversations[0]);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: 'Hola, necesito información sobre sus servicios',
      sender: 'customer',
      timestamp: '10:30 AM',
      status: 'delivered',
      whatsappId: 'wamid.123456789'
    },
    {
      id: 2,
      text: '¡Hola! Claro, con mucho gusto te ayudo. ¿Qué servicio específico te interesa?',
      sender: 'agent',
      timestamp: '10:31 AM',
      status: 'sent',
      whatsappId: 'wamid.987654321'
    }
  ]);

  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [n8nStatus, setN8nStatus] = useState('connecting');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [railwayUrl, setRailwayUrl] = useState('');
  const messagesEndRef = useRef(null);

  // Detectar URL de Railway
  useEffect(() => {
    const currentUrl = window.location.origin;
    setRailwayUrl(currentUrl);
    console.log('🚄 Desplegado en Railway:', currentUrl);
  }, []);

  // Simular conexión con n8n
  const testN8nConnection = async () => {
    setN8nStatus('connecting');
    setConnectionAttempts(prev => prev + 1);
    
    try {
      // En Railway, esto sería una llamada real a tu instancia de n8n
      const testEndpoint = `${N8N_WEBHOOK_URL}/health`;
      
      // Simular conexión (en Railway harías fetch real)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simular éxito/fallo basado en intentos
      if (connectionAttempts < 2 || Math.random() > 0.3) {
        setN8nStatus('connected');
        setIsConnected(true);
        console.log('✅ Conectado a n8n:', testEndpoint);
        
        // Simular registro del webhook para recibir mensajes
        registerWhatsAppWebhook();
      } else {
        throw new Error('Connection timeout');
      }
    } catch (error) {
      setN8nStatus('error');
      setIsConnected(false);
      console.error('❌ Error conectando con n8n:', error);
      
      // Reintentar automáticamente
      setTimeout(() => {
        if (connectionAttempts < 5) {
          testN8nConnection();
        }
      }, 5000);
    }
  };

  // Registrar webhook para recibir mensajes de WhatsApp
  const registerWhatsAppWebhook = async () => {
    try {
      const webhookConfig = {
        url: `${railwayUrl}/api/whatsapp/receive`,
        events: ['messages', 'message_status'],
        verify_token: 'whatsapp_webhook_token'
      };
      
      console.log('📱 Registrando webhook WhatsApp:', webhookConfig);
      
      // En implementación real:
      // await fetch(`${N8N_WEBHOOK_URL}/configure-whatsapp`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${N8N_API_KEY}`
      //   },
      //   body: JSON.stringify(webhookConfig)
      // });
      
    } catch (error) {
      console.error('Error registrando webhook:', error);
    }
  };

  // Simular mensaje entrante desde WhatsApp
  const simulateWhatsAppMessage = () => {
    const incomingMessages = [
      '¿Están abiertos los fines de semana?',
      'Me interesa el plan premium',
      'No puedo acceder a mi cuenta',
      '¿Cuál es el precio del servicio básico?',
      'Excelente servicio, muchas gracias',
      '¿Hacen instalaciones a domicilio?'
    ];
    
    const randomMessage = incomingMessages[Math.floor(Math.random() * incomingMessages.length)];
    
    const newMsg = {
      id: Date.now(),
      text: randomMessage,
      sender: 'customer',
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      status: 'delivered',
      whatsappId: `wamid.${Date.now()}`
    };
    
    setMessages(prev => [...prev, newMsg]);
    
    // Actualizar conversación
    setConversations(prev => 
      prev.map(conv => 
        conv.id === selectedConversation.id 
          ? { 
              ...conv, 
              lastMessage: newMsg.text, 
              timestamp: newMsg.timestamp, 
              unread: conv.unread + 1,
              status: 'active'
            }
          : conv
      )
    );

    // Simular webhook hacia tu sistema
    console.log('📥 Mensaje entrante vía n8n:', {
      from: selectedConversation.contact.phone,
      message: randomMessage,
      timestamp: newMsg.timestamp,
      webhook_url: `${railwayUrl}/api/webhook/message-received`
    });
  };

  // Enviar mensaje a WhatsApp via n8n
  const sendMessageToWhatsApp = async () => {
    if (!newMessage.trim() || !isConnected) return;

    const message = {
      id: Date.now(),
      text: newMessage,
      sender: 'agent',
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
      whatsappId: null
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');

    try {
      // En Railway, esta sería la llamada real a n8n
      const payload = {
        to: selectedConversation.contact.phone,
        message: message.text,
        conversation_id: selectedConversation.id,
        agent_id: 'agent_001',
        timestamp: new Date().toISOString()
      };

      console.log('📤 Enviando via n8n a WhatsApp:', payload);

      // Simular llamada a n8n
      // const response = await fetch(`${N8N_WEBHOOK_URL}/send-whatsapp`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${N8N_API_KEY}`
      //   },
      //   body: JSON.stringify(payload)
      // });

      // Simular respuesta exitosa
      setTimeout(() => {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === message.id 
              ? { 
                  ...msg, 
                  status: 'delivered',
                  whatsappId: `wamid.${Date.now()}`
                } 
              : msg
          )
        );
      }, 1500);

    } catch (error) {
      console.error('❌ Error enviando mensaje:', error);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === message.id ? { ...msg, status: 'failed' } : msg
        )
      );
    }
  };

  // Auto-scroll en mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Inicializar conexión
  useEffect(() => {
    testN8nConnection();
    
    // Simular mensajes periódicos para demo
    const interval = setInterval(() => {
      if (Math.random() > 0.8) {
        simulateWhatsAppMessage();
      }
    }, 30000); // Cada 30 segundos

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (n8nStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (n8nStatus) {
      case 'connected': return 'n8n Conectado';
      case 'connecting': return 'Conectando...';
      case 'error': return 'Error Conexión';
      default: return 'Desconectado';
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Chatwoot + n8n</h1>
              <p className="text-xs text-gray-500">🚄 Railway Deploy</p>
            </div>
            <div className="flex flex-col items-end space-y-1">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
                <span className="text-sm text-gray-600">{getStatusText()}</span>
              </div>
              {railwayUrl && (
                <a 
                  href={railwayUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  {railwayUrl.replace('https://', '')}
                </a>
              )}
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar conversaciones..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => setSelectedConversation(conversation)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                selectedConversation.id === conversation.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-semibold">
                  <User className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 truncate">{conversation.contact.name}</h3>
                    <span className="text-xs text-gray-500">{conversation.timestamp}</span>
                  </div>
                  <p className="text-sm text-gray-600 truncate mt-1">{conversation.lastMessage}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">{conversation.contact.phone}</span>
                    <div className="flex items-center space-x-2">
                      {conversation.unread > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                          {conversation.unread}
                        </span>
                      )}
                      <div className={`w-2 h-2 rounded-full ${
                        conversation.status === 'active' ? 'bg-green-500' :
                        conversation.status === 'pending' ? 'bg-yellow-500' : 'bg-gray-400'
                      }`}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Control Panel */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={simulateWhatsAppMessage}
              className="bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center justify-center space-x-1"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Simular WhatsApp</span>
            </button>
            <button
              onClick={testN8nConnection}
              className="bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center justify-center space-x-1"
              disabled={n8nStatus === 'connecting'}
            >
              {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span>Reconectar</span>
            </button>
          </div>
          <div className="text-xs text-gray-500 text-center">
            Intentos: {connectionAttempts} | Status: {n8nStatus}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-semibold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{selectedConversation.contact.name}</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  <span>{selectedConversation.contact.phone}</span>
                  <span className="text-green-600">• WhatsApp Business</span>
                  {isConnected && <span className="text-blue-600">• n8n Active</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <Bell className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <Settings className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.sender === 'agent'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <div className={`flex items-center justify-between mt-2 ${
                  message.sender === 'agent' ? 'text-blue-200' : 'text-gray-500'
                }`}>
                  <span className="text-xs">{message.timestamp}</span>
                  <div className="flex items-center space-x-1">
                    {message.whatsappId && (
                      <span className="text-xs opacity-75">WhatsApp</span>
                    )}
                    {message.sender === 'agent' && (
                      <div className="flex">
                        {message.status === 'sending' && (
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                        )}
                        {message.status === 'sent' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                        {message.status === 'delivered' && (
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        )}
                        {message.status === 'failed' && (
                          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-center space-x-3">
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <Paperclip className="w-5 h-5" />
            </button>
            <div className="flex-1 relative">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessageToWhatsApp()}
                placeholder={isConnected ? "Escribe un mensaje..." : "Conectando con n8n..."}
                disabled={!isConnected}
                className="w-full px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
              <button className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700">
                <Smile className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={sendMessageToWhatsApp}
              disabled={!newMessage.trim() || !isConnected}
              className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          {/* Status Footer */}
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <MessageCircle className="w-3 h-3 mr-1" />
                WhatsApp Business API
              </span>
              <span className="flex items-center">
                <Shield className="w-3 h-3 mr-1" />
                Via n8n Webhook
              </span>
            </div>
            <span className="text-blue-600">🚄 Railway Deploy Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;