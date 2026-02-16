import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { Tag, MessageSquare, Settings, RotateCw, Menu, EyeOff } from 'lucide-react';

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
import EditContactModal from './components/Sidebar/EditContactModal';
import NewChatModal from './components/Sidebar/NewChatModal';
import SettingsModal from './components/Settings/SettingsModal';
import MainLayout from './components/MainLayout';
import AIArea from './components/AI/AIArea';
import Dashboard from './components/Dashboard/Dashboard';

// Hooks
import { useConversations } from './hooks/useConversations';
import { useTags } from './hooks/useTags';

// Styles
import './styles/index.css';

// --- CONFIGURATION ---
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');
const API_URL = process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');

console.log('🌐 Configured API_URL:', API_URL);
console.log('🔌 Configured SOCKET_URL:', SOCKET_URL);

const AuthenticatedApp = () => {
    const { user, logout } = useAuth();

    // Socket connection
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    // Navigation state
    const [activeTab, setActiveTab] = useState('chat');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Mobile menu state
    const isMounted = React.useRef(false);

    // UI state
    const [isMobile, setIsMobile] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('sidebarWidth');
        return saved ? parseInt(saved, 10) : 360;
    });
    const [isResizing, setIsResizing] = useState(false);

    // Filters
    const [selectedTagIds, setSelectedTagIds] = useState([]);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const [dateFilter, setDateFilter] = useState(null);

    // Modals
    const [showTagManager, setShowTagManager] = useState(false);
    const [showBulkMessage, setShowBulkMessage] = useState(false);
    const [showN8NTest, setShowN8NTest] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Forward Message State
    const [forwardMessage, setForwardMessage] = useState(null);
    const [showForwardModal, setShowForwardModal] = useState(false);

    const [fontSize, setFontSize] = useState(() => {
        return localStorage.getItem('chat-font-size') || '16px';
    });

    // Apply font size to document root
    useEffect(() => {
        document.documentElement.style.fontSize = fontSize;
        localStorage.setItem('chat-font-size', fontSize);
    }, [fontSize]);

    // Tags by conversation
    const [tagsByPhone, setTagsByPhone] = useState({});

    // Initialize socket connection
    useEffect(() => {
        const socketInstance = io(SOCKET_URL, {
            transports: ['websocket'],
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            forceNew: false,
            autoConnect: true
        });

        socketInstance.on('connect', () => {
            console.log('🟢 Connected to Socket.IO');
            setIsConnected(true);
            socketInstance.emit('join-conversations-list');
        });

        socketInstance.on('disconnect', () => {
            console.log('🔴 Disconnected from Socket.IO');
            setIsConnected(false);
        });

        socketInstance.on('reconnect', (attemptNumber) => {
            console.log(`🔄 Reconnected to Socket.IO after ${attemptNumber} attempts`);
            setIsConnected(true);
        });

        socketInstance.on('reconnect_attempt', () => {
            console.log('🔌 Attempting to reconnect...');
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
        isLoadingMore,
        hasMore,
        aiStatesByPhone,
        selectConversation,
        sendMessage,
        sendFile,
        toggleAI,
        markConversationAsUnread,
        loadMoreConversations,
        searchConversations,
        fetchConversations
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

    // Persist sidebar width to localStorage
    useEffect(() => {
        localStorage.setItem('sidebarWidth', sidebarWidth);
    }, [sidebarWidth]);

    // Auto-refresh when PWA becomes visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('🔄 App became visible, checking connections...');

                // Reconnect socket if disconnected
                if (socket && !socket.connected) {
                    console.log('🔌 Reconnecting socket...');
                    socket.connect();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [socket]);

    // Load tags for selected conversation only (not all conversations)
    useEffect(() => {
        if (selectedConversation) {
            const phone = selectedConversation.contact.phone;
            getConversationTags(phone).then(convTags => {
                setTagsByPhone(prev => ({ ...prev, [phone]: convTags }));
            });
        }
    }, [selectedConversation, getConversationTags]);

    // Calculate start/end dates for the backend based on dateFilter string
    const dateRange = useMemo(() => {
        if (!dateFilter) return { start: null, end: null };

        const start = new Date();
        const end = new Date();
        end.setHours(23, 59, 59, 999);

        switch (dateFilter) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                break;
            case 'yesterday':
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                const prevDayEnd = new Date();
                prevDayEnd.setDate(prevDayEnd.getDate() - 1);
                prevDayEnd.setHours(23, 59, 59, 999);
                return { start: start.toISOString(), end: prevDayEnd.toISOString() };
            case 'last7':
                start.setDate(start.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                break;
            case 'last30':
                start.setDate(start.getDate() - 30);
                start.setHours(0, 0, 0, 0);
                break;
            case 'last90':
                start.setDate(start.getDate() - 90);
                start.setHours(0, 0, 0, 0);
                break;
            default:
                return { start: null, end: null };
        }

        return {
            start: start.toISOString(),
            end: end.toISOString()
        };
    }, [dateFilter]);

    // Primary fetch controller
    useEffect(() => {
        const activeTagId = selectedTagIds.length === 1 ? selectedTagIds[0] : null;
        const timeoutId = setTimeout(() => {
            fetchConversations(
                1,
                searchQuery,
                false,
                activeTagId,
                dateRange.start,
                dateRange.end
            );
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [fetchConversations, activeTab, selectedTagIds, dateFilter, searchQuery, dateRange]);

    // Filter conversations
    const filteredConversations = useMemo(() => {
        let result = conversations;
        if (showUnreadOnly) {
            result = result.filter(conv => conv.unread > 0);
        }
        if (selectedTagIds.length > 0) {
            result = result.filter(conv => {
                const convTags = conv.tags || tagsByPhone[conv.contact.phone] || [];
                return selectedTagIds.some(tagId =>
                    convTags.some(t => t.id === tagId)
                );
            });
        }
        return result;
    }, [conversations, showUnreadOnly, selectedTagIds, tagsByPhone]);

    // Count unread
    const unreadCount = useMemo(() => {
        return conversations.filter(c => c.unread > 0).length;
    }, [conversations]);

    // Handlers
    const handleToggleTag = useCallback((tagId) => {
        setSelectedTagIds(prev =>
            prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
        );
    }, []);

    const handleClearFilters = useCallback(() => {
        setSelectedTagIds([]);
        setShowUnreadOnly(false);
        setDateFilter(null);
    }, []);

    const handleSelectConversation = useCallback((conversation) => {
        selectConversation(conversation);
        if (isMobile) {
            setShowSidebar(false);
        }
    }, [selectConversation, isMobile]);

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

    const handleSendFile = useCallback(async (file, caption) => {
        if (!selectedConversation) return;
        try {
            await sendFile(
                selectedConversation.contact.phone,
                file,
                caption,
                selectedConversation.contact.name,
                {
                    agentId: user?.id,
                    agentName: user?.name
                }
            );
        } catch (error) {
            console.error('Error in App handleSendFile:', error);
            alert('Error al enviar el archivo');
        }
    }, [selectedConversation, sendFile, user]);

    const handleBulkSend = useCallback(async (phonesOrFilters, message, mediaFile = null, mediaOptions = null) => {
        let recipients = [];
        let filters = null;

        // Determine if we're sending explicit recipients or filters
        if (Array.isArray(phonesOrFilters)) {
            recipients = phonesOrFilters.map(phone => {
                const conv = conversations.find(c => c.contact.phone === phone);
                return { phone, name: conv?.contact.name || 'Unknown' };
            });
        } else {
            // It's a filter object
            filters = phonesOrFilters;
            console.log('Using server-side filters:', filters);
        }

        if (mediaFile || (mediaOptions && mediaOptions.mediaUrl)) {
            // Check if we have a file or a URL (forwarding)
            const isUrl = !mediaFile && mediaOptions && mediaOptions.mediaUrl;

            if (filters) {
                // If using filters with media, we can't use the sequential client-side sending
                // We must rely on the backend (which we updated to handle this, theoretically, but wait...)
                // The backend /send-file ENDPOINT (singular) doesn't support bulk.
                // The /bulk-send endpoint IS what we want to use for both text and media if we have filters.

                let mediaUrlToSend = null;
                let mediaTypeToSend = null;

                if (isUrl) {
                    mediaUrlToSend = mediaOptions.mediaUrl;
                    mediaTypeToSend = mediaOptions.mediaType;
                } else {
                    // We need to upload the file first.
                    const formData = new FormData();
                    formData.append('file', mediaFile);
                    const uploadRes = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
                    if (!uploadRes.ok) throw new Error('Error subiendo archivo para envío masivo');
                    const { file: uploadedFile } = await uploadRes.json();
                    mediaUrlToSend = uploadedFile.url;
                    mediaTypeToSend = uploadedFile.type;
                }

                // Now proceed to bulk send with the URL
                const response = await fetch(`${API_URL}/api/bulk-send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipients: [], // Empty recipients
                        filters, // Pass filters
                        message,
                        mediaUrl: mediaUrlToSend,
                        mediaType: mediaTypeToSend, // 'image', 'video', etc.
                        agentId: user?.id,
                        agentName: user?.name,
                        agent_id: user?.id,
                        agent_name: user?.name
                    })
                });

                if (!response.ok) throw new Error('Error al iniciar envío masivo con archivo');
                const result = await response.json();
                return result;

            } else {
                console.warn('⚠️ Bulk send with media uses sequential sending for explicit list');

                // If forwarding via URL to explicit list, we can use /bulk-send directly or replicate /send-file logic
                // But /send-file endpoint handles file upload.
                // If we have a URL, using /bulk-send (with explicit recipients) is much better/faster than looping /send-file
                // provided /bulk-send handles explicit recipients + mediaUrl correctly.
                // Backend /bulk-send DOES handle recipients + mediaUrl.

                if (isUrl) {
                    const response = await fetch(`${API_URL}/api/bulk-send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            recipients, // Explicit recipients with phones
                            message,
                            mediaUrl: mediaOptions.mediaUrl,
                            mediaType: mediaOptions.mediaType,
                            agentId: user?.id,
                            agentName: user?.name,
                            agent_id: user?.id,
                            agent_name: user?.name
                        })
                    });
                    if (!response.ok) throw new Error('Error al reenviar medios a lista explícita');
                    return await response.json();
                }

                // If it's a File object (uploading new), we stick to sequential loop using /send-file 
                // OR we upload once and use bulk-send. Uploading once is better.
                // Let's optimize: Upload once, use bulk-send.

                const formData = new FormData();
                formData.append('file', mediaFile);
                const uploadRes = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });

                if (uploadRes.ok) {
                    const { file: uploadedFile } = await uploadRes.json();
                    const response = await fetch(`${API_URL}/api/bulk-send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            recipients,
                            message,
                            mediaUrl: uploadedFile.url,
                            mediaType: uploadedFile.type,
                            agentId: user?.id,
                            agentName: user?.name,
                            agent_id: user?.id,
                            agent_name: user?.name
                        })
                    });
                    if (!response.ok) throw new Error('Error al iniciar envío masivo con archivo');
                    return await response.json();
                }

                // Fallback to sequential if upload fails? No, just throw.
                throw new Error('Error subiendo archivo para envío masivo');
            }
        }

        console.log(`📤 Sending bulk message via /api/bulk-send`);
        const response = await fetch(`${API_URL}/api/bulk-send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipients: filters ? [] : recipients,
                filters: filters || undefined,
                message,
                agentId: user?.id,
                agentName: user?.name,
                agent_id: user?.id,
                agent_name: user?.name
            })
        });

        if (!response.ok) throw new Error('Error al iniciar envío masivo');
        const result = await response.json();
        console.log('✅ Bulk send initiated:', result);
        return result;
    }, [conversations, user]);

    const handleForwardMessage = useCallback((message) => {
        setForwardMessage(message);
        setShowForwardModal(true);
    }, []);

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

    const [conversationToTag, setConversationToTag] = useState(null);

    const handleMouseDown = (e) => {
        if (isMobile) return;
        setIsResizing(true);
    };

    const handleMouseMove = useCallback((e) => {
        if (!isResizing || isMobile) return;
        window.requestAnimationFrame(() => {
            if (!isResizing) return;
            const newWidth = Math.max(300, Math.min(1000, e.clientX));
            setSidebarWidth(newWidth);
        });
    }, [isResizing, isMobile]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isResizing) {
            document.body.classList.add('is-resizing');
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        } else {
            document.body.classList.remove('is-resizing');
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.body.classList.remove('is-resizing');
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, handleMouseMove, handleMouseUp]);

    const handleOpenTagManager = useCallback((conversation, e) => {
        if (e) e.stopPropagation();
        setConversationToTag(conversation);
        setShowTagManager(true);
    }, []);

    const currentMessages = selectedConversation
        ? messagesByConversation[selectedConversation.contact.phone] || []
        : [];

    const targetConversation = conversationToTag || selectedConversation;
    const currentConversationTags = targetConversation
        ? tagsByPhone[targetConversation.contact.phone] || []
        : [];

    const handleMarkUnread = useCallback(async (phone) => {
        await markConversationAsUnread(phone);
        selectConversation(null);
        if (isMobile) {
            setShowSidebar(true);
        }
    }, [markConversationAsUnread, selectConversation, isMobile]);

    // Exponer fetchConversations globalmente para que el Service Worker o el componente Pull-to-Refresh puedan usarlo
    useEffect(() => {
        window.fetchConversations = fetchConversations;
    }, [fetchConversations]);

    const handleTabChange = useCallback((tab) => {
        if (tab === 'settings') {
            setShowSettings(true);
        } else if (tab === 'bulk') {
            setShowBulkMessage(true);
        } else {
            console.log('Changing tab to:', tab);
            setActiveTab(tab);
            // If switching back to chat, ensure sidebar is visible on desktop
            if (tab === 'chat' && !isMobile) {
                setShowSidebar(true);
            }
        }
    }, [isMobile]);

    const [showNewChat, setShowNewChat] = useState(false);

    const handleStartNewChat = async (phone) => {
        // Build API URL
        let apiUrl = '/api';
        if (process.env.REACT_APP_API_URL) apiUrl = process.env.REACT_APP_API_URL;
        else if (window.location.hostname !== 'localhost') apiUrl = 'https://largebotinterfaz-production-5b38.up.railway.app';

        if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);

        // Fix double /api if present in base URL or constructed URL
        const finalUrl = apiUrl.includes('/api') ? `${apiUrl}/conversations/start-new` : `${apiUrl}/api/conversations/start-new`;
        const cleanUrl = finalUrl.replace(/([^:]\/)\/+/g, "$1");

        const res = await fetch(cleanUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Error al verificar número');
        }

        const newConv = data.conversation;

        // Select conversation (will trigger open chat)
        // If it's not in the list, we might need to refresh or manually add it
        // Ideally fetchConversations should pick it up if we refresh, or we optimistically add it.
        // Let's reload conversations to be safe and ensure consistent state
        await fetchConversations();

        selectConversation(newConv);
        if (isMobile) setShowSidebar(false);
    };

    return (
        <MainLayout
            activeTab={activeTab}
            onTabChange={handleTabChange}
            isMobile={isMobile}
            onLogout={logout}
            hideHeader={isMobile && activeTab === 'chat'} // Hide default header on mobile chat
            isMenuOpen={isMobileMenuOpen}
            onMenuOpen={() => setIsMobileMenuOpen(true)}
            onMenuClose={() => setIsMobileMenuOpen(false)}
        >
            <div className="app-container" style={{
                display: activeTab === 'chat' ? 'flex' : 'none',
                height: '100%',
                width: '100%',
                maxWidth: '100vw',
                overflowX: 'hidden'
            }}>
                {/* Sidebar */}
                <div
                    className={`sidebar ${isMobile && showSidebar ? 'open' : ''}`}
                    style={!isMobile ? { width: `${sidebarWidth}px` } : {}}
                >
                    {/* Sidebar Header */}
                    <div className="sidebar-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            {isMobile && (
                                <button
                                    className="btn btn-icon"
                                    onClick={() => setIsMobileMenuOpen(true)}
                                    style={{ marginRight: '4px' }}
                                >
                                    <Menu className="w-5 h-5" />
                                </button>
                            )}
                            <MessageSquare className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>Chat</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                            {/* Connection status */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                <span className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)' }}>
                                    {isConnected ? 'Conectado' : 'Desconectado'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Search & New Chat */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '12px' }}>
                        <div style={{ flex: 1 }}>
                            <SearchBar
                                value={searchQuery}
                                onChange={setSearchQuery}
                            />
                        </div>
                        <button
                            className="btn-icon"
                            title="Nuevo Chat / Verificar WhatsApp"
                            onClick={() => setShowNewChat(true)}
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'white',
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <UserPlus className="w-5 h-5" />
                        </button>
                    </div>

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
                        unreadCount={unreadCount}
                        onRefresh={fetchConversations}
                        isLoading={isLoading}
                        fontSize={fontSize}
                        onFontSizeChange={setFontSize}
                    />


                    {/* Conversation List */}
                    <ConversationList
                        conversations={filteredConversations}
                        selectedId={selectedConversation?.id}
                        searchQuery={searchQuery}
                        aiStatesByPhone={aiStatesByPhone}
                        tagsByPhone={tagsByPhone}
                        isLoading={isLoading}
                        isLoadingMore={isLoadingMore}
                        hasMore={hasMore}
                        onSelect={handleSelectConversation}
                        onTagClick={handleOpenTagManager}
                        onRefresh={() => fetchConversations()}
                        onLoadMore={() => {
                            const activeTagId = selectedTagIds.length === 1 ? selectedTagIds[0] : null;
                            loadMoreConversations(activeTagId, dateRange.start, dateRange.end);
                        }}
                    />

                    {/* Resize handle - Desktop only */}
                    {!isMobile && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                right: -6,
                                width: '12px',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'ew-resize',
                                zIndex: 10,
                                transition: 'all var(--transition-fast)'
                            }}
                            onMouseDown={handleMouseDown}
                        >
                            {/* Visual indicator */}
                            <div
                                style={{
                                    width: '4px',
                                    height: '80px',
                                    backgroundColor: isResizing ? 'var(--color-primary)' : 'var(--color-gray-300)',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    boxShadow: isResizing ? '0 0 8px rgba(0,0,0,0.2)' : '0 0 4px rgba(0,0,0,0.1)',
                                    transition: 'all var(--transition-fast)',
                                    opacity: 0.7
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                    e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                }}
                                onMouseLeave={(e) => {
                                    if (!isResizing) {
                                        e.currentTarget.style.opacity = '0.7';
                                        e.currentTarget.style.backgroundColor = 'var(--color-gray-300)';
                                    }
                                }}
                            >
                                {/* Arrows icon */}
                                <div style={{
                                    color: 'white',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    userSelect: 'none',
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)'
                                }}>
                                    ⟷
                                </div>
                            </div>
                        </div>
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
                                onMarkUnread={handleMarkUnread}
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
                                {(tagsByPhone[selectedConversation.contact.phone] || []).map(tag => (
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
                                    onClick={() => {
                                        setConversationToTag(selectedConversation);
                                        setShowTagManager(true);
                                    }}
                                    style={{
                                        padding: '2px 8px',
                                        fontSize: 'var(--font-size-xs)',
                                        backgroundColor: 'var(--color-gray-100)'
                                    }}
                                >
                                    <Tag className="w-3 h-3" />
                                    <span style={{ marginLeft: '4px' }}>Etiquetas</span>
                                </button>

                                <button
                                    className="btn btn-icon"
                                    onClick={() => handleMarkUnread(selectedConversation.contact.phone)}
                                    title="Marcar como no leído"
                                    style={{
                                        color: 'var(--color-primary)',
                                        marginLeft: 'auto' // Push to the right
                                    }}
                                >
                                    <EyeOff className="w-5 h-5" />
                                </button>
                            </div>

                            <MessageList
                                messages={currentMessages}
                                isLoading={isLoadingMessages}
                                onForward={handleForwardMessage}
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
            </div >

            {showNewChat && (
                <NewChatModal
                    isOpen={showNewChat}
                    onClose={() => setShowNewChat(false)}
                    onStartChat={handleStartNewChat}
                />
            )}

            {/* Modals - Moved outside app-container to be visible in all tabs */}
            <TagManager
                isOpen={showTagManager}
                onClose={() => {
                    setShowTagManager(false);
                    setConversationToTag(null);
                }}
                tags={tags}
                conversationPhone={targetConversation?.contact.phone}
                conversationTags={currentConversationTags}
                onCreateTag={handleCreateTag}
                onAssignTag={handleAssignTag}
                onRemoveTag={handleRemoveTag}
                onMarkUnread={handleMarkUnread}
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

            {/* Forward Message Modal (Reuses BulkMessageModal) */}
            {forwardMessage && (
                <BulkMessageModal
                    isOpen={showForwardModal}
                    onClose={() => {
                        setShowForwardModal(false);
                        setForwardMessage(null);
                    }}
                    conversations={conversations}
                    tags={tags}
                    tagsByPhone={tagsByPhone}
                    onSend={handleBulkSend}
                    socket={socket}
                    initialMessage={forwardMessage.text || ''}
                    initialMediaUrl={forwardMessage.mediaUrl || forwardMessage.media_url || null}
                    initialMediaType={forwardMessage.mediaType || forwardMessage.media_type || null}
                    title="Reenviar Mensaje"
                    disableSelectionModeChange={true}
                />
            )}

            <N8NTestChat
                isOpen={showN8NTest}
                onClose={() => setShowN8NTest(false)}
            />

            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />

            {activeTab === 'dashboard' && <Dashboard isMobile={isMobile} />}
            {activeTab === 'ai' && <AIArea isMobile={isMobile} />}
        </MainLayout>
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
