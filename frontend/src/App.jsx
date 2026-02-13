import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { Tag, MessageSquare, Send, Settings } from 'lucide-react';

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
import SettingsModal from './components/Settings/SettingsModal';

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
    const [showSettings, setShowSettings] = useState(false);

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
            // Join global conversations list room
            socketInstance.emit('join-conversations-list');
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
        toggleAI
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
    }, [conversations, getConversationTags, tagsByPhone]);

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

    // State for tagging from list
    const [conversationToTag, setConversationToTag] = useState(null);

    // Sidebar resize handlers
    const handleMouseDown = (e) => {
        if (isMobile) return;
        setIsResizing(true);
    };

    const handleMouseMove = useCallback((e) => {
        if (!isResizing || isMobile) return;
        const newWidth = Math.max(300, Math.min(800, e.clientX)); // Increased max width
        setSidebarWidth(newWidth);
    }, [isResizing, isMobile]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
    }, []);

    // ... (rest of effects)

    const handleOpenTagManager = useCallback((conversation, e) => {
        if (e) e.stopPropagation();
        setConversationToTag(conversation);
        setShowTagManager(true);
    }, []);

    // ...

    // Current conversation tags (for selected or tagging)
    const targetConversation = conversationToTag || selectedConversation;
    const currentConversationTags = targetConversation
        ? tagsByPhone[targetConversation.contact.phone] || []
        : [];

    return (
        <div className="app-container">
            {/* Sidebar */}
            <div
                className={`sidebar ${isMobile && showSidebar ? 'open' : ''}`}
                style={!isMobile ? { width: `${sidebarWidth}px` } : {}}
            >
                {/* ... (Sidebar Header) ... */}

                {/* ... (SearchBar and TagFilter) ... */}

                {/* Conversation List */}
                <ConversationList
                    conversations={filteredConversations}
                    selectedId={selectedConversation?.id}
                    searchQuery={searchQuery}
                    aiStatesByPhone={aiStatesByPhone}
                    tagsByPhone={tagsByPhone}
                    isLoading={isLoading}
                    onSelect={handleSelectConversation}
                    onTagClick={handleOpenTagManager}
                />

                {/* ... (Resize Handle) ... */}
            </div>

            {/* ... (Chat Area) ... */}

            {/* Modals */}
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

            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </div >
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
