import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { Tag, MessageSquare, Send, Bot } from 'lucide-react';

// Auth
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './components/Auth/LoginPage';

// Components
import SearchBar from './components/Sidebar/SearchBar';
import ConversationList from './components/Sidebar/ConversationList';
import TagFilter from './components/Sidebar/TagFilter';
import ChatHeader from './components/Chat/ChatHeader';
import MessageList from './components/Chat/MessageList';
import MessageInput from './components/Chat/MessageInput';
import TagManager from './components/Tags/TagManager';
import BulkMessageModal from './components/BulkMessaging/BulkMessageModal';
import N8NTestChat from './components/Testing/N8NTestChat';

// Hooks
import { useConversations } from './hooks/useConversations';
import { useTags } from './hooks/useTags';

// Styles
import './styles/index.css';

// --- CONFIGURATION ---
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const AuthenticatedApp = () => {
    const { user, logout } = useAuth();

    // Socket connection
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    // UI state
    const [isMobile, setIsMobile] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sidebarWidth, setSidebarWidth] = useState(360);
    const [isResizing, setIsResizing] = useState(false);

    // Filters
    const [selectedTagIds, setSelectedTagIds] = useState([]);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const [dateFilter, setDateFilter] = useState(null);

    // Modals
    const [showTagManager, setShowTagManager] = useState(false);
    const [showBulkMessage, setShowBulkMessage] = useState(false);
    const [showN8NTest, setShowN8NTest] = useState(false);

    // Tags by conversation
    const [tagsByPhone, setTagsByPhone] = useState({});

    // Initialize socket connection
    useEffect(() => {
        const socketInstance = io(SOCKET_URL, {
            transports: ['websocket'],
            reconnectionAttempts: 5,
        });

        socketInstance.on('connect', () => {
            console.log('🟢 Connected to Socket.IO');
            setIsConnected(true);
        });

        socketInstance.on('disconnect', () => {
            console.log('🔴 Disconnected from Socket.IO');
            setIsConnected(false);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    // Custom hooks
    const {
        conversations,
        selectedConversation,
        messagesByConversation,
        isLoading,
        isLoadingMessages,
        aiStatesByPhone,
        selectConversation,
        sendMessage,
        toggleAI,
        setSelectedConversation
    } = useConversations(socket);

    const {
        tags,
        createTag,
        getConversationTags,
        assignTag,
        removeTag
    } = useTags();

    // Mobile detection - show sidebar by default on mobile
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
            // En móvil, mostrar sidebar por defecto (se oculta al seleccionar conversación)
            // En desktop, siempre mostrar sidebar
            if (!mobile) {
                setShowSidebar(true);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Load tags for all conversations on mount
    useEffect(() => {
        const loadAllTags = async () => {
            for (const conv of conversations) {
                const phone = conv.contact.phone;
                if (!tagsByPhone[phone]) {
                    const convTags = await getConversationTags(phone);
                    setTagsByPhone(prev => ({ ...prev, [phone]: convTags }));
                }
            }
        };
        if (conversations.length > 0) {
            loadAllTags();
        }
    }, [conversations, getConversationTags]);

    // Load tags for selected conversation
    useEffect(() => {
        if (selectedConversation) {
            const phone = selectedConversation.contact.phone;
            getConversationTags(phone).then(convTags => {
                setTagsByPhone(prev => ({ ...prev, [phone]: convTags }));
            });
        }
    }, [selectedConversation, getConversationTags]);

    // Filter conversations based on tags and unread status
    const filteredConversations = useMemo(() => {
        let result = conversations;

        // Filter by unread
        if (showUnreadOnly) {
            result = result.filter(conv => conv.unread > 0);
        }

        // Filter by tags
        if (selectedTagIds.length > 0) {
            result = result.filter(conv => {
                const convTags = tagsByPhone[conv.contact.phone] || [];
                return selectedTagIds.some(tagId =>
                    convTags.some(t => t.id === tagId)
                );
            });
        }

        // Filter by date
        if (dateFilter) {
            let cutoffDate = new Date();

            switch (dateFilter) {
                case 'today':
                    cutoffDate.setHours(0, 0, 0, 0);
                    break;
                case 'yesterday':
                    cutoffDate.setDate(cutoffDate.getDate() - 1);
                    cutoffDate.setHours(0, 0, 0, 0);
                    break;
                case 'last7':
                    cutoffDate.setDate(cutoffDate.getDate() - 7);
                    break;
                case 'last30':
                    cutoffDate.setDate(cutoffDate.getDate() - 30);
                    break;
                case 'last90':
                    cutoffDate.setDate(cutoffDate.getDate() - 90);
                    break;
                default:
                    cutoffDate = null;
            }

            if (cutoffDate) {
                result = result.filter(conv => {
                    // Use rawTimestamp which contains last_message_timestamp from backend
                    const convDate = conv.rawTimestamp ? new Date(conv.rawTimestamp) : null;
                    if (!convDate || isNaN(convDate.getTime())) return false;
                    return convDate >= cutoffDate;
                });
            }
        }

        return result;
    }, [conversations, showUnreadOnly, selectedTagIds, tagsByPhone, dateFilter]);

    // Count unread conversations
    const unreadCount = useMemo(() => {
        return conversations.filter(c => c.unread > 0).length;
    }, [conversations]);

    // Handle filter toggle
    const handleToggleTag = useCallback((tagId) => {
        setSelectedTagIds(prev =>
            prev.includes(tagId)
                ? prev.filter(id => id !== tagId)
                : [...prev, tagId]
        );
    }, []);

    const handleClearFilters = useCallback(() => {
        setSelectedTagIds([]);
        setShowUnreadOnly(false);
        setDateFilter(null);
    }, []);

    // Handle conversation selection
    const handleSelectConversation = useCallback((conversation) => {
        selectConversation(conversation);
        if (isMobile) {
            setShowSidebar(false);
        }
    }, [selectConversation, isMobile]);

    // Handle send message
    const handleSendMessage = useCallback((message) => {
        console.log('👤 Sending message as user:', user);
        if (selectedConversation) {
            sendMessage(
                selectedConversation.contact.phone,
                message,
                selectedConversation.contact.name,
                {
                    agentId: user?.id,
                    agentName: user?.name
                }
            );
        }
    }, [selectedConversation, sendMessage, user]);

    // Handle send file
    const handleSendFile = useCallback(async (file, caption) => {
        if (!selectedConversation) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('phone', selectedConversation.contact.phone);
        formData.append('name', selectedConversation.contact.name);
        if (caption) formData.append('caption', caption);

        // Add agent info
        if (user) {
            formData.append('agent_id', user.id);
            formData.append('agent_name', user.name);
        }

        try {
            const response = await fetch(`${API_URL}/api/send-file`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Error sending file');

            const result = await response.json();
            console.log('File sent:', result);
            return result;
        } catch (error) {
            console.error('Error sending file:', error);
            throw error;
        }
    }, [selectedConversation, user]);

    // Handle bulk message - SCALABLE VERSION
    // Uses backend processing with progress tracking via Socket.IO
    const handleBulkSend = useCallback(async (phones, message, mediaFile = null) => {
        // Build recipients array with phone and name
        const recipients = phones.map(phone => {
            const conv = conversations.find(c => c.contact.phone === phone);
            return {
                phone,
                name: conv?.contact.name || 'Unknown'
            };
        });

        // If there's a media file, we need to upload it first
        let mediaUrl = null;
        let mediaType = null;

        if (mediaFile) {
            // TODO: For media files, we'd need to upload first and get URL
            // For now, media bulk send will use the old method
            console.warn('⚠️ Bulk send with media uses sequential sending');

            for (const { phone, name } of recipients) {
                const formData = new FormData();
                formData.append('file', mediaFile);
                formData.append('phone', phone);
                formData.append('name', name);
                if (message) formData.append('caption', message);
                // Add agent info
                if (user) {
                    formData.append('agent_id', user.id);
                    formData.append('agent_name', user.name);
                }

                try {
                    await fetch(`${API_URL}/api/send-file`, {
                        method: 'POST',
                        body: formData
                    });
                } catch (error) {
                    console.error(`Error sending file to ${phone}:`, error);
                }
                // Delay between sends
                await new Promise(resolve => setTimeout(resolve, 150));
            }
            return { success: true, method: 'sequential' };
        }

        // Use new bulk endpoint for text-only messages
        console.log(`📤 Sending bulk message to ${recipients.length} recipients via /api/bulk-send`);

        const response = await fetch(`${API_URL}/api/bulk-send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipients,
                message,
                mediaUrl,
                mediaType,
                agentId: user?.id,
                agentName: user?.name,
                agent_id: user?.id,
                agent_name: user?.name
            })
        });

        if (!response.ok) {
            throw new Error('Error al iniciar envío masivo');
        }

        const result = await response.json();
        console.log('✅ Bulk send initiated:', result);

        return result;
    }, [conversations, user]);

    // Handle tag operations
    const handleCreateTag = useCallback(async (name, color) => {
        const newTag = await createTag(name, color);
        return newTag;
    }, [createTag]);

    const handleAssignTag = useCallback(async (phone, tagId) => {
        await assignTag(phone, tagId);
        const updatedTags = await getConversationTags(phone);
        setTagsByPhone(prev => ({ ...prev, [phone]: updatedTags }));
    }, [assignTag, getConversationTags]);

    const handleRemoveTag = useCallback(async (phone, tagId) => {
        await removeTag(phone, tagId);
        const updatedTags = await getConversationTags(phone);
        setTagsByPhone(prev => ({ ...prev, [phone]: updatedTags }));
    }, [removeTag, getConversationTags]);

    // Sidebar resize handlers
    const handleMouseDown = (e) => {
        if (isMobile) return;
        setIsResizing(true);
    };

    const handleMouseMove = useCallback((e) => {
        if (!isResizing || isMobile) return;
        const newWidth = Math.max(300, Math.min(480, e.clientX));
        setSidebarWidth(newWidth);
    }, [isResizing, isMobile]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, handleMouseMove, handleMouseUp]);

    // Current conversation messages
    const currentMessages = selectedConversation
        ? messagesByConversation[selectedConversation.contact.phone] || []
        : [];

    // Current conversation tags
    const currentConversationTags = selectedConversation
        ? tagsByPhone[selectedConversation.contact.phone] || []
        : [];

    return (
        <div className="app-container">
            {/* Sidebar */}
            <div
                className={`sidebar ${isMobile && showSidebar ? 'open' : ''}`}
                style={!isMobile ? { width: `${sidebarWidth}px` } : {}}
            >
                {/* Sidebar Header */}
                <div className="sidebar-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <MessageSquare className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>Chat</span>
                        {unreadCount > 0 && (
                            <span style={{
                                backgroundColor: 'var(--color-primary-light)',
                                color: '#fff',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-full)',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600
                            }}>
                                {unreadCount} no leídos
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {/* Connection status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                            <span className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)' }}>
                                {isConnected ? 'Conectado' : 'Desconectado'}
                            </span>
                        </div>

                        {/* Bulk message button - more prominent */}
                        <button
                            className="btn"
                            onClick={() => setShowBulkMessage(true)}
                            title="Envío masivo"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-1)',
                                backgroundColor: 'var(--color-primary)',
                                color: 'white',
                                padding: '6px 12px',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 500
                            }}
                        >
                            <Send className="w-4 h-4" />
                            Masivo
                        </button>

                        {/* N8N Test button */}
                        <button
                            className="btn btn-icon"
                            onClick={() => setShowN8NTest(true)}
                            title="Probar n8n"
                            style={{
                                backgroundColor: '#6366f1',
                                color: 'white',
                                padding: '6px'
                            }}
                        >
                            <Bot className="w-4 h-4" />
                        </button>

                        {/* Logout button */}
                        <button
                            className="btn btn-icon"
                            onClick={logout}
                            title="Cerrar sesión"
                            style={{
                                backgroundColor: '#ef4444',
                                color: 'white',
                                padding: '6px'
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Search */}
                <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                />

                {/* Tag Filter */}
                <TagFilter
                    tags={tags}
                    selectedTagIds={selectedTagIds}
                    onToggleTag={handleToggleTag}
                    onClearFilter={handleClearFilters}
                    showUnreadOnly={showUnreadOnly}
                    onToggleUnreadOnly={() => setShowUnreadOnly(!showUnreadOnly)}
                    dateFilter={dateFilter}
                    onDateFilterChange={setDateFilter}
                />

                {/* Conversation List */}
                <ConversationList
                    conversations={filteredConversations}
                    selectedId={selectedConversation?.id}
                    searchQuery={searchQuery}
                    aiStatesByPhone={aiStatesByPhone}
                    tagsByPhone={tagsByPhone}
                    isLoading={isLoading}
                    onSelect={handleSelectConversation}
                />

                {/* Resize handle - Desktop only */}

                {!isMobile && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: '4px',
                            height: '100%',
                            backgroundColor: isResizing ? 'var(--color-primary)' : 'transparent',
                            cursor: 'ew-resize',
                            transition: 'background-color var(--transition-fast)'
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-gray-300)'}
                        onMouseLeave={(e) => {
                            if (!isResizing) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    />
                )}
            </div>

            {/* Chat Area */}
            <div
                className="chat-container"
                style={isMobile && showSidebar ? { display: 'none' } : {}}
            >
                {selectedConversation ? (
                    <>
                        <ChatHeader
                            conversation={selectedConversation}
                            aiEnabled={aiStatesByPhone[selectedConversation.contact.phone] ?? true}
                            onToggleAI={toggleAI}
                            onBack={() => setShowSidebar(true)}
                            isMobile={isMobile}
                        />

                        {/* Tags bar */}
                        <div style={{
                            padding: 'var(--space-2) var(--space-4)',
                            backgroundColor: 'var(--color-white)',
                            borderBottom: '1px solid var(--color-gray-200)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            flexWrap: 'wrap'
                        }}>
                            {currentConversationTags.map(tag => (
                                <span
                                    key={tag.id}
                                    className="tag tag-small"
                                    style={{ backgroundColor: tag.color, color: '#fff' }}
                                >
                                    {tag.name}
                                </span>
                            ))}
                            <button
                                className="btn btn-icon"
                                onClick={() => setShowTagManager(true)}
                                style={{
                                    padding: '2px 8px',
                                    fontSize: 'var(--font-size-xs)',
                                    backgroundColor: 'var(--color-gray-100)'
                                }}
                            >
                                <Tag className="w-3 h-3" />
                                <span style={{ marginLeft: '4px' }}>Etiquetas</span>
                            </button>
                        </div>

                        <MessageList
                            messages={currentMessages}
                            isLoading={isLoadingMessages}
                        />

                        <MessageInput
                            onSend={handleSendMessage}
                            onSendFile={handleSendFile}
                            disabled={false}
                            isMobile={isMobile}
                        />
                    </>
                ) : (
                    <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <MessageSquare className="w-16 h-16" style={{ color: 'var(--color-gray-300)' }} />
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{
                                fontSize: 'var(--font-size-xl)',
                                fontWeight: 600,
                                color: 'var(--color-gray-700)',
                                marginBottom: 'var(--space-2)'
                            }}>
                                Selecciona una conversación
                            </h2>
                            <p style={{ color: 'var(--color-gray-500)' }}>
                                Elige una conversación de la lista para comenzar
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <TagManager
                isOpen={showTagManager}
                onClose={() => setShowTagManager(false)}
                tags={tags}
                conversationPhone={selectedConversation?.contact.phone}
                conversationTags={currentConversationTags}
                onCreateTag={handleCreateTag}
                onAssignTag={handleAssignTag}
                onRemoveTag={handleRemoveTag}
            />

            <BulkMessageModal
                isOpen={showBulkMessage}
                onClose={() => setShowBulkMessage(false)}
                conversations={conversations}
                tags={tags}
                tagsByPhone={tagsByPhone}
                onSend={handleBulkSend}
                socket={socket}
            />

            <N8NTestChat
                isOpen={showN8NTest}
                onClose={() => setShowN8NTest(false)}
            />
        </div>
    );
};

// Root Component with Auth Provider
const App = () => {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
};

// Auth Guard Content
const AppContent = () => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f3f4f6',
                color: '#4b5563',
                fontSize: '1.25rem'
            }}>
                Cargando...
            </div>
        );
    }

    return isAuthenticated ? <AuthenticatedApp /> : <LoginPage />;
};

export default App;
