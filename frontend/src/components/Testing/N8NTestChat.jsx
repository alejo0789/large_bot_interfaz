import React, { useState, useEffect, useRef } from 'react';
import {
    X, Send, Bot, Trash2, RefreshCw,
    Settings, Wifi, WifiOff, MessageCircle
} from 'lucide-react';

// N8N webhook URL from environment variable (can be overridden in settings)
const DEFAULT_N8N_WEBHOOK = process.env.REACT_APP_N8N_WEBHOOK_URL || '';

/**
 * N8N Test Chat Component
 * Simulates a WhatsApp conversation to test the n8n AI agent workflow
 */
const N8NTestChat = ({ isOpen, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [testPhone, setTestPhone] = useState('573001234567');
    const [testName, setTestName] = useState('Usuario Prueba');
    const [isLoading, setIsLoading] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState(DEFAULT_N8N_WEBHOOK);
    const [showSettings, setShowSettings] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const messagesEndRef = useRef(null);

    // Session key for memory (this is what n8n uses)
    const sessionKey = testPhone;

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        // Check webhook connectivity
        const checkWebhookConnection = async () => {
            // Just check if URL is valid
            try {
                const url = new URL(webhookUrl);
                setIsConnected(!!url.hostname);
            } catch (error) {
                setIsConnected(false);
            }
        };

        checkWebhookConnection();
    }, [webhookUrl]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const sendTestMessage = async () => {
        if (!inputMessage.trim() || !webhookUrl) return;

        const userMessage = {
            id: Date.now(),
            text: inputMessage,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMessage]);
        const messageToSend = inputMessage;
        setInputMessage('');
        setIsLoading(true);

        try {
            // Send to n8n webhook in WhatsApp Trigger format
            const payload = {
                contacts: [{
                    wa_id: testPhone,
                    profile: { name: testName }
                }],
                messages: [{
                    from: testPhone,
                    id: `test_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                    text: { body: messageToSend },
                    type: 'text',
                    timestamp: Math.floor(Date.now() / 1000).toString()
                }]
            };

            console.log('📤 Sending to n8n:', payload);

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            let responseText = '';
            try {
                responseText = await response.text();
            } catch (e) {
                responseText = '(sin respuesta)';
            }

            console.log('📨 n8n response:', responseText);

            if (response.ok && responseText) {
                // Try to parse as JSON first
                let botMessage = responseText;
                try {
                    const jsonResponse = JSON.parse(responseText);
                    // Handle different response formats
                    if (jsonResponse.output) {
                        botMessage = jsonResponse.output;
                    } else if (jsonResponse.message) {
                        botMessage = jsonResponse.message;
                    } else if (jsonResponse.text) {
                        botMessage = jsonResponse.text;
                    } else if (typeof jsonResponse === 'string') {
                        botMessage = jsonResponse;
                    }
                } catch (e) {
                    // Response is plain text, use as is
                    botMessage = responseText;
                }

                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    text: botMessage,
                    sender: 'bot',
                    timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                }]);
            } else if (!response.ok) {
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    text: `❌ Error ${response.status}: ${responseText || response.statusText}`,
                    sender: 'system',
                    timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                }]);
            } else {
                // Workflow might not return a response (fire and forget)
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    text: '✅ Mensaje enviado a n8n (sin respuesta directa - revisa el flujo)',
                    sender: 'system',
                    timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                }]);
            }

        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                text: `❌ Error de conexión: ${error.message}`,
                sender: 'system',
                timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearMessages = () => {
        setMessages([]);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendTestMessage();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{
                    maxWidth: '500px',
                    height: '80vh',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {/* Header */}
                <div className="modal-header" style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    color: 'white',
                    borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Bot className="w-6 h-6" />
                        <div>
                            <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>
                                Test AI Agent (n8n)
                            </h3>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: 'var(--font-size-xs)',
                                opacity: 0.9
                            }}>
                                {isConnected ? (
                                    <>
                                        <Wifi className="w-3 h-3" />
                                        Webhook configurado
                                    </>
                                ) : (
                                    <>
                                        <WifiOff className="w-3 h-3" />
                                        Sin webhook
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            style={{
                                background: showSettings ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                padding: '6px',
                                cursor: 'pointer',
                                color: 'white'
                            }}
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                padding: '6px',
                                cursor: 'pointer',
                                color: 'white'
                            }}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Settings Panel */}
                {showSettings && (
                    <div style={{
                        padding: 'var(--space-3)',
                        backgroundColor: 'var(--color-gray-50)',
                        borderBottom: '1px solid var(--color-gray-200)'
                    }}>
                        <div style={{ marginBottom: 'var(--space-2)' }}>
                            <label style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: 'var(--color-gray-600)'
                            }}>
                                Webhook n8n:
                            </label>
                            <input
                                type="text"
                                value={webhookUrl}
                                onChange={(e) => setWebhookUrl(e.target.value)}
                                placeholder="https://n8n.example.com/webhook/..."
                                style={{
                                    width: '100%',
                                    padding: 'var(--space-2)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-gray-300)',
                                    fontSize: 'var(--font-size-xs)',
                                    fontFamily: 'monospace'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 600,
                                    color: 'var(--color-gray-600)'
                                }}>
                                    Teléfono:
                                </label>
                                <input
                                    type="text"
                                    value={testPhone}
                                    onChange={(e) => setTestPhone(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--space-2)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-gray-300)',
                                        fontSize: 'var(--font-size-sm)'
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 600,
                                    color: 'var(--color-gray-600)'
                                }}>
                                    Nombre:
                                </label>
                                <input
                                    type="text"
                                    value={testName}
                                    onChange={(e) => setTestName(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--space-2)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-gray-300)',
                                        fontSize: 'var(--font-size-sm)'
                                    }}
                                />
                            </div>
                        </div>
                        <div style={{
                            padding: 'var(--space-2)',
                            backgroundColor: '#e0e7ff',
                            borderRadius: 'var(--radius-md)',
                            marginTop: 'var(--space-2)'
                        }}>
                            <div style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: '#4338ca',
                                marginBottom: '4px'
                            }}>
                                🔑 Session Key para Memory:
                            </div>
                            <code style={{
                                fontSize: 'var(--font-size-sm)',
                                color: '#4338ca',
                                backgroundColor: 'white',
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-sm)',
                                display: 'block'
                            }}>
                                {sessionKey}
                            </code>
                        </div>
                    </div>
                )}

                {/* Messages */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 'var(--space-3)',
                    backgroundColor: '#f0f2f5'
                }}>
                    {messages.length === 0 && (
                        <div style={{
                            textAlign: 'center',
                            color: 'var(--color-gray-500)',
                            marginTop: 'var(--space-8)'
                        }}>
                            <MessageCircle className="w-12 h-12" style={{ margin: '0 auto', opacity: 0.5 }} />
                            <p style={{ marginTop: 'var(--space-2)', fontWeight: 500 }}>
                                Simula una conversación con el AI Agent
                            </p>
                            <p style={{ fontSize: 'var(--font-size-xs)' }}>
                                Los mensajes se envían al webhook de n8n
                            </p>
                        </div>
                    )}

                    {messages.map(msg => (
                        <div
                            key={msg.id}
                            style={{
                                display: 'flex',
                                justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                                marginBottom: 'var(--space-2)'
                            }}
                        >
                            <div style={{
                                maxWidth: '85%',
                                padding: 'var(--space-2) var(--space-3)',
                                borderRadius: msg.sender === 'user'
                                    ? '16px 16px 4px 16px'
                                    : '16px 16px 16px 4px',
                                backgroundColor: msg.sender === 'user'
                                    ? '#6366f1'
                                    : msg.sender === 'bot'
                                        ? '#10b981'
                                        : 'var(--color-gray-200)',
                                color: msg.sender === 'system' ? 'var(--color-gray-700)' : 'white',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}>
                                {msg.sender === 'bot' && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        marginBottom: '4px',
                                        fontSize: 'var(--font-size-xs)',
                                        opacity: 0.9
                                    }}>
                                        <Bot className="w-3 h-3" /> Amelia (AI)
                                    </div>
                                )}
                                {msg.sender === 'system' && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        marginBottom: '4px',
                                        fontSize: 'var(--font-size-xs)',
                                        opacity: 0.8
                                    }}>
                                        <Settings className="w-3 h-3" /> Sistema
                                    </div>
                                )}
                                <div style={{
                                    fontSize: 'var(--font-size-sm)',
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: 1.4
                                }}>
                                    {msg.text}
                                </div>
                                <div style={{
                                    fontSize: '10px',
                                    opacity: 0.7,
                                    textAlign: 'right',
                                    marginTop: '4px'
                                }}>
                                    {msg.timestamp}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-start',
                            marginBottom: 'var(--space-2)'
                        }}>
                            <div style={{
                                padding: 'var(--space-2) var(--space-3)',
                                borderRadius: '16px 16px 16px 4px',
                                backgroundColor: '#10b981',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <RefreshCw className="w-4 h-4" style={{ animation: 'spin 1s linear infinite' }} />
                                Amelia está escribiendo...
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{
                    padding: 'var(--space-3)',
                    backgroundColor: 'white',
                    borderTop: '1px solid var(--color-gray-200)',
                    display: 'flex',
                    gap: 'var(--space-2)'
                }}>
                    <button
                        onClick={clearMessages}
                        style={{
                            padding: 'var(--space-2)',
                            backgroundColor: 'var(--color-gray-100)',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            color: 'var(--color-gray-600)'
                        }}
                        title="Limpiar mensajes"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Escribe un mensaje..."
                        disabled={isLoading || !webhookUrl}
                        style={{
                            flex: 1,
                            padding: 'var(--space-2) var(--space-3)',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--color-gray-300)',
                            fontSize: 'var(--font-size-sm)'
                        }}
                    />
                    <button
                        onClick={sendTestMessage}
                        disabled={isLoading || !inputMessage.trim() || !webhookUrl}
                        style={{
                            padding: 'var(--space-2) var(--space-3)',
                            backgroundColor: '#6366f1',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-full)',
                            cursor: (isLoading || !webhookUrl) ? 'not-allowed' : 'pointer',
                            opacity: (isLoading || !webhookUrl) ? 0.7 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-1)'
                        }}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default N8NTestChat;
