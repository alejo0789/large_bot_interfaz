import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

/**
 * Custom hook for managing conversations
 * @param {Object} socket - Socket.IO instance
 * @returns {Object} Conversation state and handlers
 */
export const useConversations = (socket) => {
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messagesByConversation, setMessagesByConversation] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [aiStatesByPhone, setAiStatesByPhone] = useState({});

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch all conversations with pagination
    const fetchConversations = useCallback(async (page = 1, search = '', append = false) => {
        try {
            if (!append) setIsLoading(true);
            else setIsLoadingMore(true);

            console.log(`🔄 Fetching conversations (page ${page}, search: "${search}")...`);

            const params = new URLSearchParams({
                page: page.toString(),
                limit: '100', // Changed from 50 to 100
            });

            if (search) {
                params.append('search', search);
            }

            const response = await fetch(`${API_URL}/api/conversations?${params}`);
            if (!response.ok) throw new Error('Error fetching conversations');

            const data = await response.json();

            // Handle both paginated and legacy response formats
            const newConversations = Array.isArray(data) ? data : (data.data || []);

            // Check if there are more pages
            if (data.pagination) {
                setHasMore(data.pagination.hasNext);
                setCurrentPage(data.pagination.page);
            } else {
                setHasMore(false);
            }

            if (append) {
                // Append to existing conversations (infinite scroll)
                setConversations(prev => [...prev, ...newConversations]);
            } else {
                // Replace conversations (new search or initial load)
                setConversations(newConversations);
            }

            // Initialize AI states from loaded conversations
            const initialAiStates = {};
            newConversations.forEach(conv => {
                initialAiStates[conv.contact.phone] = conv.aiEnabled;
            });
            setAiStatesByPhone(prev => ({ ...prev, ...initialAiStates }));

            console.log(`✅ Loaded ${newConversations.length} conversations (page ${page})`);

            return data;
        } catch (error) {
            console.error('❌ Error fetching conversations:', error);
            return [];
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, []);

    // Load more conversations (for infinite scroll)
    const loadMoreConversations = useCallback(async () => {
        if (!hasMore || isLoadingMore) return;
        await fetchConversations(currentPage + 1, searchQuery, true);
    }, [currentPage, hasMore, isLoadingMore, searchQuery, fetchConversations]);

    // Search conversations (server-side)
    const searchConversations = useCallback(async (query) => {
        setSearchQuery(query);
        setCurrentPage(1);
        setHasMore(true);
        await fetchConversations(1, query, false);
    }, [fetchConversations]);

    // Fetch messages for a specific conversation
    const fetchMessages = useCallback(async (phone) => {
        try {
            setIsLoadingMessages(true);
            console.log(`🔄 Fetching messages for ${phone}...`);

            const response = await fetch(`${API_URL}/api/conversations/${phone}/messages`);
            if (!response.ok) throw new Error('Error fetching messages');

            const data = await response.json();
            // Handle both paginated and legacy response formats
            const messages = Array.isArray(data) ? data : (data.data || []);

            // Log first message for debugging
            if (messages.length > 0) {
                console.log('📅 First message rawTimestamp:', messages[0].rawTimestamp);
            }

            // Messages already have rawTimestamp from backend, just use them directly
            setMessagesByConversation(prev => ({
                ...prev,
                [phone]: messages
            }));

            console.log(`✅ Loaded ${messages.length} messages for ${phone}`);
            return data;
        } catch (error) {
            console.error(`❌ Error fetching messages for ${phone}:`, error);
            return [];
        } finally {
            setIsLoadingMessages(false);
        }
    }, []);

    // Mark conversation as read
    const markConversationAsRead = useCallback(async (phone) => {
        try {
            await fetch(`${API_URL}/api/conversations/${phone}/mark-read`, { method: 'POST' });

            setConversations(prev => prev.map(conv =>
                conv.contact.phone === phone ? { ...conv, unread: 0 } : conv
            ));
        } catch (error) {
            console.error('❌ Error marking as read:', error);
        }
    }, []);

    // Select a conversation
    const selectConversation = useCallback(async (conversation) => {
        const phone = conversation.contact.phone;
        console.log('🎯 Selecting conversation:', phone);

        // Leave previous room if any
        if (selectedConversation && socket) {
            socket.emit('leave-conversation', selectedConversation.contact.phone);
        }

        setSelectedConversation(conversation);

        // Join new room for real-time updates
        if (socket) {
            console.log('📱 Joining socket room for:', phone);
            socket.emit('join-conversation', phone);
        }

        if (conversation.unread > 0) {
            await markConversationAsRead(phone);
        }

        await fetchMessages(phone);
    }, [fetchMessages, selectedConversation, socket, markConversationAsRead]);

    // Send a message
    const sendMessage = useCallback(async (phone, message, name, options = {}) => {
        const tempId = Date.now();
        const currentAIState = Boolean(aiStatesByPhone[phone] ?? true);
        const { agentId, agentName } = options;

        const newMessage = {
            id: tempId,
            text: message,
            sender: 'agent', // Always 'agent' so it appears on the right
            agent_name: agentName, // Display name
            timestamp: new Date().toLocaleTimeString('es-CO', {
                hour: '2-digit',
                minute: '2-digit'
            }),
            rawTimestamp: new Date().toISOString(),
            status: 'sending'
        };

        // Optimistic update
        setMessagesByConversation(prev => ({
            ...prev,
            [phone]: [...(prev[phone] || []), newMessage]
        }));

        setConversations(prev => prev.map(conv =>
            conv.contact.phone === phone
                ? {
                    ...conv,
                    lastMessage: message,
                    timestamp: newMessage.timestamp,
                    rawTimestamp: newMessage.rawTimestamp
                }
                : conv
        ));

        try {
            console.log(`📤 Sending message to ${phone}: ${message}`);
            const response = await fetch(`${API_URL}/api/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: String(phone), // Ensure it's a string
                    message,
                    name,
                    temp_id: tempId,
                    ai_enabled: currentAIState,
                    agent_id: agentId,
                    agent_name: agentName
                })
            });

            if (!response.ok) {
                throw new Error('Error sending message');
            }

            // Update status to delivered
            setMessagesByConversation(prev => ({
                ...prev,
                [phone]: prev[phone].map(msg =>
                    msg.id === tempId ? { ...msg, status: 'delivered' } : msg
                )
            }));

            return true;
        } catch (error) {
            console.error('❌ Error sending message:', error);

            // Update status to failed
            setMessagesByConversation(prev => ({
                ...prev,
                [phone]: prev[phone].map(msg =>
                    msg.id === tempId ? { ...msg, status: 'failed' } : msg
                )
            }));

            return false;
        }
    }, [aiStatesByPhone]);

    // Toggle AI for a conversation
    const toggleAI = useCallback(async (phone) => {
        const currentState = Boolean(aiStatesByPhone[phone] ?? true);
        const newState = !currentState;

        // Optimistic update
        setAiStatesByPhone(prev => ({ ...prev, [phone]: newState }));

        try {
            const response = await fetch(`${API_URL}/api/conversations/${phone}/toggle-ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aiEnabled: newState })
            });

            if (!response.ok) {
                // Revert on error
                setAiStatesByPhone(prev => ({ ...prev, [phone]: currentState }));
                throw new Error('Error toggling AI');
            }

            console.log(`✅ AI ${newState ? 'enabled' : 'disabled'} for ${phone}`);
        } catch (error) {
            console.error('❌ Error toggling AI:', error);
            setAiStatesByPhone(prev => ({ ...prev, [phone]: currentState }));
        }
    }, [aiStatesByPhone]);

    // Handle incoming messages from socket
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (messageData) => {
            console.log('📨 New message received:', messageData);

            const senderType = messageData.sender_type || messageData.sender || 'customer';

            // Ignore messages sent by agent - they were already added optimistically
            if (senderType === 'agent' || senderType === 'me') {
                console.log('⏭️ Ignoring agent message (already added optimistically)');
                return;
            }

            const formattedMessage = {
                id: messageData.whatsapp_id || Date.now(),
                text: messageData.message || messageData.text,
                sender: senderType,
                timestamp: new Date(messageData.timestamp).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                rawTimestamp: messageData.timestamp || new Date().toISOString(),
                status: 'delivered',
                // Media support
                media_type: messageData.media_type || null,
                media_url: messageData.media_url || null
            };

            // Check for duplicates before adding
            setMessagesByConversation(prev => {
                const existingMessages = prev[messageData.phone] || [];

                // Check if message with same ID already exists
                const isDuplicate = existingMessages.some(msg =>
                    msg.id === formattedMessage.id ||
                    (msg.text === formattedMessage.text &&
                        Math.abs(new Date(msg.rawTimestamp) - new Date(formattedMessage.rawTimestamp)) < 5000)
                );

                if (isDuplicate) {
                    console.log('⏭️ Ignoring duplicate message');
                    return prev;
                }

                return {
                    ...prev,
                    [messageData.phone]: [...existingMessages, formattedMessage]
                };
            });

            setConversations(prev => prev.map(conv =>
                conv.contact.phone === messageData.phone
                    ? {
                        ...conv,
                        lastMessage: formattedMessage.text,
                        timestamp: formattedMessage.timestamp,
                        rawTimestamp: formattedMessage.rawTimestamp,
                        unread: selectedConversation?.contact.phone === messageData.phone
                            ? 0
                            : (conv.unread || 0) + 1
                    }
                    : conv
            ));
        };

        const handleStateChange = (data) => {
            setAiStatesByPhone(prev => ({
                ...prev,
                [data.phone]: data.state === 'ai_active'
            }));
        };

        socket.on('new-message', handleNewMessage);
        socket.on('conversation-state-changed', handleStateChange);

        return () => {
            socket.off('new-message', handleNewMessage);
            socket.off('conversation-state-changed', handleStateChange);
        };
    }, [socket, selectedConversation]);

    // Initial fetch
    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    return {
        conversations,
        selectedConversation,
        messagesByConversation,
        isLoading,
        isLoadingMessages,
        isLoadingMore,
        hasMore,
        aiStatesByPhone,
        fetchConversations,
        fetchMessages,
        selectConversation,
        sendMessage,
        toggleAI,
        setSelectedConversation,
        loadMoreConversations,
        searchConversations
    };
};

export default useConversations;
