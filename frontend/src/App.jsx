import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiFetch from './utils/api';
import { useDrag } from '@use-gesture/react';
import { io } from 'socket.io-client';
import { Tag, MessageSquare, Settings, RotateCw, Menu, EyeOff, CheckSquare } from 'lucide-react';

// Auth
import { AuthProvider, useAuth } from './hooks/useAuth';
import { TenantProvider, useTenant } from './hooks/useTenant';
import LoginPage from './components/Auth/LoginPage';
import TenantSelectorPage from './components/Navigation/TenantSelectorPage';

// Components
import SearchBar from './components/Sidebar/SearchBar';
import SedeSelector from './components/Navigation/SedeSelector';
import ConversationList from './components/Sidebar/ConversationList';
import TagFilter from './components/Sidebar/TagFilter';
import ChatHeader from './components/Chat/ChatHeader';
import MessageList from './components/Chat/MessageList';
import MessageInput from './components/Chat/MessageInput';
import TagManager from './components/Tags/TagManager';
import BulkMessageModal from './components/BulkMessaging/BulkMessageModal';
import N8NTestChat from './components/Testing/N8NTestChat';
import EditContactModal from './components/Sidebar/EditContactModal';
import SettingsModal from './components/Settings/SettingsModal';
import ScheduleModal from './components/Modals/ScheduleModal';
import MainLayout from './components/MainLayout';
import AIArea from './components/AI/AIArea';
import Dashboard from './components/Dashboard/Dashboard';
import BulkActionsBar from './components/Sidebar/BulkActionsBar';
import AdminPanel from './components/Admin/AdminPanel';
import Celebration from './components/UI/Celebration';

// Hooks
import { useConversations } from './hooks/useConversations';
import { useTags } from './hooks/useTags';
import { useSocket } from './hooks/useSocket';

// Styles
import './styles/index.css';

// --- CONFIGURATION ---
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');
const API_URL = process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');

console.log('ðŸŒ Configured API_URL:', API_URL);
console.log('ðŸ”Œ Configured SOCKET_URL:', SOCKET_URL);

const AuthenticatedApp = () => {
    const { user, logout } = useAuth();


    // Navigation state
    const [activeTab, setActiveTab] = useState('chat');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Mobile menu state
    const isMounted = React.useRef(false);

    // UI state
    const [isMobile, setIsMobile] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [isRailCollapsed, setIsRailCollapsed] = useState(() => {
        const saved = localStorage.getItem('isRailCollapsed');
        return saved !== null ? JSON.parse(saved) : false;
    });
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
    const [leadTimeFilter, setLeadTimeFilter] = useState(null);

    // Modals
    const [showTagManager, setShowTagManager] = useState(false);
    const [showBulkMessage, setShowBulkMessage] = useState(false);
    const [showN8NTest, setShowN8NTest] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleMessage, setScheduleMessage] = useState(null);
    const [draftMessage, setDraftMessage] = useState(null);

    // Forward Message State
    const [forwardMessage, setForwardMessage] = useState(null);
    const [showForwardModal, setShowForwardModal] = useState(false);

    // Sweep Mode (Escobita)
    const [isSweepMode, setIsSweepMode] = useState(false);
    const [lastSelectedPhone, setLastSelectedPhone] = useState(null);
    const [lastSelectedTimestamp, setLastSelectedTimestamp] = useState(null);

    // Reply Message State
    const [replyToMessage, setReplyToMessage] = useState(null);

    // Editing Message State
    const [editingMessage, setEditingMessage] = useState(null);

    const [showCelebration, setShowCelebration] = useState(false);
    const [agendasCount, setAgendasCount] = useState(0);

    // Multi-selection state
    const [selectedConversationIds, setSelectedConversationIds] = useState([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [bulkMessageInitialPhones, setBulkMessageInitialPhones] = useState([]);
    const [bulkMessageInitialMode, setBulkMessageInitialMode] = useState(null);
    const [bulkMessageInitialLeadTime, setBulkMessageInitialLeadTime] = useState(null);

    // Fetch daily agendas count
    useEffect(() => {
        const fetchAgendasCount = async () => {
            try {
                const res = await apiFetch('/api/conversations/agendas-count');
                if (res.ok) {
                    const data = await res.json();
                    setAgendasCount(data.count || 0);
                }
            } catch (err) {
                console.error('Error fetching agendas count:', err);
            }
        };
        fetchAgendasCount();
    }, []);

    // Tags by conversation
    const [tagsByPhone, setTagsByPhone] = useState({});

    // Socket connection
    const { socket, isConnected } = useSocket();

    // Re-join general room on connect/reconnect
    useEffect(() => {
        if (socket && isConnected) {
            socket.emit('join-conversations-list');
        }
    }, [socket, isConnected]);

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
        fetchConversations,
        deleteMessage,
        reactToMessage,
        removeConversation,
        togglePin,
        globalDefaultAi,
        updateConversationLocal,
        messagePaginationByPhone,
        isLoadingOlderMessages,
        loadOlderMessages
    } = useConversations(socket);

    const {
        tags,
        createTag,
        updateTag,
        getConversationTags,
        assignTag,
        removeTag
    } = useTags();

    // Mobile detection - show sidebar by default on mobile
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth <= 1024;
            setIsMobile(mobile);
            // En mÃ³vil, mostrar sidebar por defecto (se oculta al seleccionar conversaciÃ³n)
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

    useEffect(() => {
        localStorage.setItem('isRailCollapsed', JSON.stringify(isRailCollapsed));
    }, [isRailCollapsed]);

    // Auto-refresh when PWA becomes visible & periodic health check
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('🔄 App became visible, checking connections...');

                // Reconnect socket if disconnected
                if (socket && !socket.connected) {
                    console.log('🔌 Reconnecting socket...');
                    socket.connect();
                } else if (socket && socket.connected) {
                    // Re-join rooms in case they were lost
                    socket.emit('join-conversations-list');
                }
            }
        };

        // Periodic health check: every 30 seconds, verify socket is in the right rooms
        const healthInterval = setInterval(() => {
            if (socket && socket.connected) {
                // Ensure we're still in the conversations:list room
                socket.emit('join-conversations-list');
            } else if (socket && !socket.connected) {
                console.log('âš ï¸ Health check: socket disconnected, attempting reconnect...');
                socket.connect();
            }
        }, 30000);

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(healthInterval);
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
                dateRange.end,
                showUnreadOnly,
                false,
                leadTimeFilter
            );
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [fetchConversations, activeTab, selectedTagIds, dateFilter, searchQuery, dateRange, showUnreadOnly, leadTimeFilter]);

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

    // Count unread (total visible)
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
        setLeadTimeFilter(null);
    }, []);

    const handleSelectConversation = useCallback((conversation) => {
        if (conversation) {
            setLastSelectedPhone(conversation.contact.phone);
            setLastSelectedTimestamp(conversation.rawTimestamp);
        }
        selectConversation(conversation);
        setReplyToMessage(null);
        if (isMobile) {
            setShowSidebar(false);
        }
    }, [selectConversation, isMobile]);

    // Sweep mode logic: find the one that was above the last processed one
    useEffect(() => {
        if (isSweepMode && !selectedConversation && lastSelectedPhone && activeTab === 'chat') {
            // Find current index of the phone we just left
            const currentIndex = filteredConversations.findIndex(c => c.contact.phone === lastSelectedPhone);

            let targetConv = null;

            if (currentIndex > 0) {
                // Normal case: pick the one right above
                targetConv = filteredConversations[currentIndex - 1];
            } else if (currentIndex === 0) {
                // It's already at the top, maybe it jumped there. 
                // We should try to find the neighbor with a timestamp just newer than our old one.
                if (lastSelectedTimestamp) {
                    const ts = new Date(lastSelectedTimestamp).getTime();
                    // Find conversations with timestamp > ts, pick the one with the smallest such timestamp
                    const candidates = filteredConversations
                        .filter(c => new Date(c.rawTimestamp).getTime() > ts)
                        .sort((a, b) => new Date(a.rawTimestamp).getTime() - new Date(b.rawTimestamp).getTime());

                    if (candidates.length > 0) {
                        targetConv = candidates[0];
                    }
                }
            } else {
                // Not found (maybe archived). 
                // We can't do much without more context, but let's try to pick something at the same index?
                // For now, let's just do nothing if not found.
            }

            if (targetConv) {
                const timeout = setTimeout(() => {
                    handleSelectConversation(targetConv);
                }, 300);
                return () => clearTimeout(timeout);
            }
        }
    }, [selectedConversation, isSweepMode, lastSelectedPhone, lastSelectedTimestamp, filteredConversations, activeTab, handleSelectConversation]);

    const handleSendMessage = useCallback(async (message) => {
        console.log('ðŸ‘¤ Sending message as user:', user);
        if (selectedConversation) {
            if (editingMessage) {
                try {
                    const response = await apiFetch(`/api/messages/${editingMessage.whatsapp_id || editingMessage.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ text: message })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Error al editar mensaje');
                    }

                    setEditingMessage(null);
                } catch (error) {
                    console.error('Error editing message:', error);
                    alert(`Error al editar: ${error.message}`);
                }
                return;
            }

            sendMessage(
                selectedConversation.contact.phone,
                message,
                selectedConversation.contact.name,
                {
                    agentId: user?.id,
                    agentName: user?.name,
                    replyTo: replyToMessage?.whatsapp_id || replyToMessage?.id,
                    replyToFull: replyToMessage ? {
                        id: replyToMessage.whatsapp_id || replyToMessage.id,
                        text: replyToMessage.text,
                        sender: replyToMessage.sender_name || (replyToMessage.sender === 'agent' ? user?.name : 'Cliente')
                    } : null
                }
            );
            setReplyToMessage(null);
        }
    }, [selectedConversation, sendMessage, user, replyToMessage, editingMessage]);

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
                    agentName: user?.name,
                    replyTo: replyToMessage?.whatsapp_id || replyToMessage?.id,
                    replyToFull: replyToMessage ? {
                        id: replyToMessage.whatsapp_id || replyToMessage.id,
                        text: replyToMessage.text,
                        sender: replyToMessage.sender_name || (replyToMessage.sender === 'agent' ? user?.name : 'Cliente')
                    } : null
                }
            );
            setReplyToMessage(null);
        } catch (error) {
            // Error is shown inline in the conversation bubble — no alert needed
            console.error('Error in App handleSendFile:', error);
        }
    }, [selectedConversation, sendFile, user, replyToMessage]);

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
                    const uploadRes = await apiFetch('/api/upload?folder=bulk', { method: 'POST', body: formData });
                    if (!uploadRes.ok) throw new Error('Error subiendo archivo para envÃ­o masivo');
                    const { file: uploadedFile } = await uploadRes.json();
                    mediaUrlToSend = uploadedFile.url;
                    mediaTypeToSend = uploadedFile.type;
                }

                // Now proceed to bulk send with the URL
                const response = await apiFetch('/api/bulk-send', {
                    method: 'POST',
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

                if (!response.ok) throw new Error('Error al iniciar envÃ­o masivo con archivo');
                const result = await response.json();
                return result;

            } else {
                console.warn('âš ï¸ Bulk send with media uses sequential sending for explicit list');

                // If forwarding via URL to explicit list, we can use /bulk-send directly or replicate /send-file logic
                // But /send-file endpoint handles file upload.
                // If we have a URL, using /bulk-send (with explicit recipients) is much better/faster than looping /send-file
                // provided /bulk-send handles explicit recipients + mediaUrl correctly.
                // Backend /bulk-send DOES handle recipients + mediaUrl.

                if (isUrl) {
                    const response = await apiFetch('/api/bulk-send', {
                        method: 'POST',
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
                    if (!response.ok) throw new Error('Error al reenviar medios a lista explÃ­cita');
                    return await response.json();
                }

                // If it's a File object (uploading new), we stick to sequential loop using /send-file 
                // OR we upload once and use bulk-send. Uploading once is better.
                // Let's optimize: Upload once, use bulk-send.

                const formData = new FormData();
                formData.append('file', mediaFile);
                const uploadRes = await apiFetch('/api/upload?folder=bulk', { method: 'POST', body: formData });

                if (uploadRes.ok) {
                    const { file: uploadedFile } = await uploadRes.json();
                    const response = await apiFetch('/api/bulk-send', {
                        method: 'POST',
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
                    if (!response.ok) throw new Error('Error al iniciar envÃ­o masivo con archivo');
                    return await response.json();
                }

                // Fallback to sequential if upload fails? No, just throw.
                throw new Error('Error subiendo archivo para envÃ­o masivo');
            }
        }

        console.log(`ðŸ“¤ Sending bulk message via /api/bulk-send`);
        const response = await apiFetch('/api/bulk-send', {
            method: 'POST',
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

        if (!response.ok) throw new Error('Error al iniciar envÃ­o masivo');
        const result = await response.json();
        console.log('âœ… Bulk send initiated:', result);
        return result;
    }, [conversations, user]);

    const handleForwardMessage = useCallback((message) => {
        setForwardMessage(message);
        setShowForwardModal(true);
    }, []);

    const handleReplyMessage = useCallback((message) => {
        setReplyToMessage(message);
    }, []);

    const handleStartBulkSend = useCallback(({ phones = [], mode = null, leadTime = null }) => {
        setBulkMessageInitialPhones(phones);
        setBulkMessageInitialMode(mode);
        setBulkMessageInitialLeadTime(leadTime);
        setShowBulkMessage(true);
    }, []);

    const handleCreateTag = useCallback(async (name, color) => {
        const newTag = await createTag(name, color);
        return newTag;
    }, [createTag]);

    const handleUpdateTag = useCallback(async (tagId, name, color) => {
        const updatedTag = await updateTag(tagId, name, color);

        // Also update local copy in tagsByPhone if we have it
        setTagsByPhone(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(phone => {
                const tags = next[phone];
                if (tags.some(t => t.id === tagId)) {
                    next[phone] = tags.map(t => t.id === tagId ? updatedTag : t);
                }
            });
            return next;
        });

        return updatedTag;
    }, [updateTag]);

    const handleAssignTag = useCallback(async (phone, tagId) => {
        await assignTag(phone, tagId, user?.id);
        const updatedTags = await getConversationTags(phone);
        setTagsByPhone(prev => ({ ...prev, [phone]: updatedTags }));
        
        // If it was the "Agendar" tag, the lead_time is cleared on the server
        const tag = tags.find(t => t.id === tagId);
        if (tag && tag.name.toLowerCase() === 'agendar') {
            updateConversationLocal(phone, { leadTime: null, tags: updatedTags });
            setShowCelebration(true); // Trigger celebration!
            setAgendasCount(prev => prev + 1); // Increment local counter
        } else {
            updateConversationLocal(phone, { tags: updatedTags });
        }
    }, [assignTag, getConversationTags, updateConversationLocal, user, tags]);

    const handleRemoveTag = useCallback(async (phone, tagId) => {
        const tag = tags.find(t => t.id === tagId);
        await removeTag(phone, tagId);
        const updatedTags = await getConversationTags(phone);
        setTagsByPhone(prev => ({ ...prev, [phone]: updatedTags }));
        
        if (tag && tag.name.toLowerCase() === 'agendar') {
            // Restore AI active state locally if un-scheduling
            updateConversationLocal(phone, { tags: updatedTags, conversationState: 'ai_active' });
            setAgendasCount(prev => Math.max(0, prev - 1));
        } else {
            updateConversationLocal(phone, { tags: updatedTags });
        }
    }, [removeTag, getConversationTags, updateConversationLocal, tags]);

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

    const handleOpenTagManagerGlobal = useCallback(() => {
        setConversationToTag(null);
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

    // Multi-selection handlers
    const enterSelectionMode = useCallback((id) => {
        setSelectedConversationIds([id]);
        setIsSelectionMode(true);
    }, []);

    const toggleConversationSelection = useCallback((id) => {
        setSelectedConversationIds(prev => {
            if (prev.includes(id)) {
                const next = prev.filter(i => i !== id);
                if (next.length === 0) setIsSelectionMode(false);
                return next;
            } else {
                return [...prev, id];
            }
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedConversationIds([]);
        setIsSelectionMode(false);
    }, []);

    const selectAllConversations = useCallback(() => {
        const allIds = filteredConversations.map(c => c.id);
        setSelectedConversationIds(allIds);
    }, [filteredConversations]);

    const handleBulkDelete = useCallback(async () => {
        if (!window.confirm(`Â¿EstÃ¡s seguro de eliminar ${selectedConversationIds.length} conversaciones?`)) return;

        // Note: For a real bulk operation, we should have a backend /bulk-delete
        // For now, we'll loop or use the existing removeConversation correctly
        let successCount = 0;
        for (const id of selectedConversationIds) {
            const conv = filteredConversations.find(c => c.id === id);
            if (conv) {
                try {
                    const phone = conv.contact.phone;
                    // Existing logic for single delete
                    let apiUrl = typeof process !== 'undefined' && process.env?.REACT_APP_API_URL
                        ? process.env.REACT_APP_API_URL
                        : window.location.hostname !== 'localhost'
                            ? 'https://largebotinterfaz-production-5b38.up.railway.app'
                            : 'http://localhost:4000';
                    if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);

                    const res = await apiFetch(`/api/conversations/${encodeURIComponent(phone)}`, {
                        method: 'DELETE'
                    });

                    if (res.ok) {
                        removeConversation(phone);
                        successCount++;
                    }
                } catch (err) {
                    console.error(`Error deleting ${id}:`, err);
                }
            }
        }
        alert(`Se eliminaron ${successCount} conversaciones.`);
        clearSelection();
    }, [selectedConversationIds, filteredConversations, removeConversation, clearSelection]);

    const handleBulkTag = useCallback(() => {
        // Find a representative conversation (or just use null) to open manager
        // We'll modify TagManager to handle multiple phones later if needed
        // For now, let's just use the first selected one to pick tags
        const firstId = selectedConversationIds[0];
        const conv = filteredConversations.find(c => c.id === firstId);
        if (conv) {
            setConversationToTag({
                ...conv,
                isBulk: true,
                phones: selectedConversationIds.map(id => filteredConversations.find(c => c.id === id)?.contact.phone).filter(Boolean)
            });
            setShowTagManager(true);
        }
    }, [selectedConversationIds, filteredConversations]);

    const handleBulkMessage = useCallback(() => {
        const phones = selectedConversationIds.map(id => filteredConversations.find(c => c.id === id)?.contact.phone).filter(Boolean);
        setBulkMessageInitialPhones(phones);
        setBulkMessageInitialMode('manual');
        setShowBulkMessage(true);
    }, [selectedConversationIds, filteredConversations]);

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



    const handleStartNewChat = async (phone) => {
        try {
            const res = await apiFetch('/api/conversations/start-new', {
                method: 'POST',
                body: JSON.stringify({ phone })
            });

            const data = await res.json();
            console.log("StartNewChat Response:", data);

            if (!res.ok) {
                throw new Error(data.error || data.message || 'El nÃºmero no se encuentra registrado en WhatsApp o la API fallÃ³.');
            }

            const rawConv = data.conversation;
            if (!rawConv) {
                throw new Error('La API no devolviÃ³ los datos de la conversaciÃ³n.');
            }

            // Normalize structure for useConversations (needs contact object)
            const newConv = {
                ...rawConv,
                contact: {
                    phone: rawConv.phone,
                    name: rawConv.contact_name || rawConv.phone
                }
            };

            // Select conversation (will trigger open chat)
            await fetchConversations();

            selectConversation(newConv);
            if (isMobile) setShowSidebar(false);

        } catch (error) {
            console.error('Error starting new chat:', error);
            alert(`No se pudo iniciar la conversaciÃ³n con este nÃºmero.\n\nMotivo: ${error.message}`);
        }
    };

    // Swipe Back Gesture for Mobile
    const bindSwipe = useDrag(({ movement: [mx], cancel, active }) => {
        if (!isMobile || !selectedConversation) return;
        // Swipe right to go back
        if (mx > 100 && !isResizing) {
            cancel();
            setShowSidebar(true);
            if (searchQuery) {
                setSearchQuery('');
                fetchConversations(1, '');
            }
            selectConversation(null); // Optional: clear selection to fully reset
        }
    }, {
        axis: 'x',
        filterTaps: true,
        rubberband: true
    });

    const handleMessageDelete = useCallback(async (message) => {
        if (!window.confirm('Â¿EstÃ¡s seguro de que quieres eliminar este mensaje?')) return;

        try {
            await deleteMessage(message.id, selectedConversation?.contact.phone);
        } catch (error) {
            console.error('Error deleting message:', error);
            alert('Error al eliminar mensaje');
        }
    }, [deleteMessage, selectedConversation]);

    const handleMessageReact = useCallback((message, emoji) => {
        // Optimistic update supported by hook
        reactToMessage(message.id, emoji, selectedConversation?.contact.phone);
    }, [reactToMessage, selectedConversation]);

    const handleScheduleMessage = useCallback((message) => {
        setScheduleMessage(message);
        setShowScheduleModal(true);
    }, []);

    const handleScheduleSubmit = useCallback((scheduleDetails, rawFormData) => {
        // En vez de enviar automáticamente, rellenamos el textarea
        setDraftMessage(scheduleDetails);
    }, []);

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
            isCollapsed={isRailCollapsed}
            onToggleCollapse={() => setIsRailCollapsed(!isRailCollapsed)}
            user={user}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                            <button
                                className="btn btn-icon"
                                onClick={() => isMobile ? setIsMobileMenuOpen(true) : setIsRailCollapsed(!isRailCollapsed)}
                                style={{
                                    color: 'var(--color-primary)',
                                    backgroundColor: 'rgba(7,94,84,0.1)',
                                    borderRadius: '8px',
                                    padding: '6px',
                                    marginRight: '8px'
                                }}
                                title={isMobile ? "MenÃº" : (isRailCollapsed ? "Mostrar NavegaciÃ³n" : "Ocultar NavegaciÃ³n")}
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--color-gray-800)' }}>Chat</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                            {/* Connection status */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                <span className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)' }}>
                                    {isConnected ? 'Conectado' : 'Desconectado'}
                                </span>
                            </div>

                            {/* Sweep Mode (Escobita) */}
                            <button
                                className={`btn btn-icon ${isSweepMode ? 'active' : ''}`}
                                onClick={() => setIsSweepMode(!isSweepMode)}
                                title={isSweepMode ? 'Desactivar Barrido' : 'Activar Barrido (Escobita)'}
                                style={{
                                    backgroundColor: isSweepMode ? 'rgba(7,94,84,0.1)' : 'transparent',
                                    color: isSweepMode ? 'var(--color-primary)' : 'var(--color-gray-500)',
                                    padding: '6px'
                                }}
                            >
                                <BroomIcon className="w-5 h-5" style={{ transform: isSweepMode ? 'rotate(-45deg)' : 'none', transition: 'transform 0.3s' }} />
                                {isSweepMode && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '0',
                                        right: '0',
                                        width: '8px',
                                        height: '8px',
                                        backgroundColor: 'var(--color-primary)',
                                        borderRadius: '50%',
                                        border: '1px solid white'
                                    }} />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Sede Selector */}
                    <div style={{ padding: '0 4px 12px 4px' }}>
                        <SedeSelector />
                    </div>

                    {/* Search */}
                    <div style={{ paddingRight: '12px' }}>
                        <SearchBar
                            value={searchQuery}
                            onChange={setSearchQuery}
                        />
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
                        onCreateTag={createTag}
                        onUpdateTag={handleUpdateTag}
                        leadTimeFilter={leadTimeFilter}
                        onLeadTimeFilterChange={setLeadTimeFilter}
                        onStartBulkSend={handleStartBulkSend}
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
                        onRefresh={() => {
                            const activeTagId = selectedTagIds.length === 1 ? selectedTagIds[0] : null;
                            fetchConversations(1, searchQuery, false, activeTagId, dateRange.start, dateRange.end, showUnreadOnly, false, leadTimeFilter);
                        }}
                        onLoadMore={() => {
                            const activeTagId = selectedTagIds.length === 1 ? selectedTagIds[0] : null;
                            loadMoreConversations(activeTagId, dateRange.start, dateRange.end, showUnreadOnly, leadTimeFilter);
                        }}
                        onStartNewChat={handleStartNewChat}
                        onDelete={removeConversation}
                        onTogglePin={togglePin}
                        globalDefaultAi={globalDefaultAi}
                        isSelectionMode={isSelectionMode}
                        selectedIds={selectedConversationIds}
                        onToggleSelection={toggleConversationSelection}
                        onEnterSelectionMode={enterSelectionMode}
                    />

                    <BulkActionsBar
                        selectedCount={selectedConversationIds.length}
                        onClear={clearSelection}
                        onDelete={handleBulkDelete}
                        onTag={handleBulkTag}
                        onMessage={handleBulkMessage}
                        onSelectAll={selectAllConversations}
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
                                    âŸ·
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
                                aiEnabled={aiStatesByPhone[selectedConversation.contact.phone] ?? globalDefaultAi}
                                onToggleAI={toggleAI}
                                onMarkUnread={handleMarkUnread}
                                onBack={() => {
                                    if (isSweepMode) {
                                        selectConversation(null);
                                    } else {
                                        setShowSidebar(true);
                                    }

                                    if (searchQuery) {
                                        setSearchQuery('');
                                        fetchConversations(1, ''); // Reload all
                                    }
                                }}
                                isMobile={isMobile}
                                isSweepMode={isSweepMode}
                                onNameUpdated={(phone, newName) => updateConversationLocal(phone, { contact: { name: newName } })}
                                agendasCount={agendasCount}
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

                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {isSweepMode && (
                                        <button
                                            className="btn btn-icon"
                                            onClick={() => setIsSweepMode(false)}
                                            title="Desactivar Barrido"
                                            style={{
                                                color: 'var(--color-primary)',
                                                backgroundColor: 'rgba(7,94,84,0.1)',
                                                borderRadius: '8px',
                                            }}
                                        >
                                            <BroomIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-icon"
                                        onClick={() => handleMarkUnread(selectedConversation.contact.phone)}
                                        title="Marcar como no leÃ­do"
                                        style={{
                                            color: 'var(--color-primary)',
                                        }}
                                    >
                                        <EyeOff className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>


                            <div {...bindSwipe()} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, touchAction: 'none' }}>
                                <MessageList
                                    messages={currentMessages}
                                    isLoading={isLoadingMessages}
                                    onForward={handleForwardMessage}
                                    onReact={handleMessageReact}
                                    onDelete={handleMessageDelete}
                                    onReply={handleReplyMessage}
                                    onEdit={setEditingMessage}
                                    onSchedule={handleScheduleMessage}
                                    onPhoneClick={handleStartNewChat}
                                    onLoadOlder={selectedConversation ? () => loadOlderMessages(selectedConversation.contact.phone) : undefined}
                                    hasMoreOlder={selectedConversation ? (messagePaginationByPhone[selectedConversation.contact.phone]?.hasMore ?? false) : false}
                                    isLoadingOlder={isLoadingOlderMessages}
                                />
                            </div>

                            <MessageInput
                                onSend={handleSendMessage}
                                onSendFile={handleSendFile}
                                disabled={false}
                                isMobile={isMobile}
                                replyToMessage={replyToMessage}
                                onCancelReply={() => setReplyToMessage(null)}
                                editingMessage={editingMessage}
                                onCancelEdit={() => setEditingMessage(null)}
                                draftMessage={draftMessage}
                                onDraftConsumed={() => setDraftMessage(null)}
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
                onUpdateTag={handleUpdateTag}
                onAssignTag={handleAssignTag}
                onRemoveTag={handleRemoveTag}
                onMarkUnread={handleMarkUnread}
                isBulk={targetConversation?.isBulk}
                bulkPhones={targetConversation?.phones}
            />

            <BulkMessageModal
                isOpen={showBulkMessage}
                onClose={() => {
                    setShowBulkMessage(false);
                    setBulkMessageInitialPhones([]);
                    setBulkMessageInitialMode(null);
                    setBulkMessageInitialLeadTime(null);
                }}
                conversations={conversations}
                tags={tags}
                tagsByPhone={tagsByPhone}
                onSend={handleBulkSend}
                socket={socket}
                initialSelectedPhones={bulkMessageInitialPhones}
                initialSelectionMode={bulkMessageInitialMode}
                initialSelectedLeadTime={bulkMessageInitialLeadTime}
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

            <Celebration 
                isVisible={showCelebration} 
                onClose={() => setShowCelebration(false)} 
            />

            <ScheduleModal
                isOpen={showScheduleModal}
                onClose={() => {
                    setShowScheduleModal(false);
                    setScheduleMessage(null);
                }}
                initialData={
                    scheduleMessage ? {
                        messageText: scheduleMessage.text,
                        contactName: selectedConversation?.contact?.name
                    } : null
                }
                onSubmit={handleScheduleSubmit}
            />

            {activeTab === 'dashboard' && <Dashboard isMobile={isMobile} />}
            {activeTab === 'ai' && <AIArea isMobile={isMobile} />}
            {activeTab === 'admin' && <AdminPanel isMobile={isMobile} />}

        </MainLayout>
    );
};

// Root Component with Auth Provider
// Custom Broom Icon for Sweep Mode
const BroomIcon = ({ className, style }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
    >
        <path d="m13 11 9-9" />
        <path d="M14.6 12.6c.8.8.9 2.1.2 3L10 22l-8-8 6.4-4.8c.9-.7 2.2-.6 3 .2Z" />
        <path d="m6.8 10.4 6.8 6.8" />
        <path d="m5 17 1.4-1.4" />
    </svg>
);

const App = () => {
    return (
        <AuthProvider>
            <TenantProvider>
                <AppContent />
            </TenantProvider>
        </AuthProvider>
    );
};

// Auth Guard Content
const AppContent = () => {
    const { isAuthenticated, loading, user } = useAuth();
    const { currentTenant } = useTenant();

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

    if (!isAuthenticated) return <LoginPage />;

    // Wait for tenant identification if authenticated
    // This prevents "Sede no especificada" errors from triggered effects on mount
    const hasTenants = user?.tenants?.length > 0 || user?.role === 'SUPER_ADMIN';

    if (isAuthenticated && hasTenants && !currentTenant) {
        // If Super Admin, show the selection cards
        if (user.role === 'SUPER_ADMIN') {
            return <TenantSelectorPage />;
        }

        // For regular users, show loading while the default tenant is auto-selected
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '24px',
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                color: '#11ab9c',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                <div style={{
                    position: 'relative',
                    width: '80px',
                    height: '80px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        border: '4px solid rgba(17, 171, 156, 0.1)',
                        borderRadius: '50%',
                        borderTopColor: '#11ab9c',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <RotateCw className="w-8 h-8" style={{ animation: 'reverse-spin 2s linear infinite' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>Cargando su Sede</h2>
                    <p style={{ color: '#6b7280', marginTop: '8px' }}>Configurando su espacio de trabajo...</p>
                </div>
                <style>{`
                    @keyframes spin { to { transform: rotate(360deg); } }
                    @keyframes reverse-spin { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
                `}</style>
            </div>
        );
    }

    return <AuthenticatedApp />;
};

export default App;
