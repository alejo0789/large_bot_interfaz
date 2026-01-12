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

    // Fetch all conversations
    const fetchConversations = useCallback(async () => {
        try {
            setIsLoading(true);
            console.log('🔄 Fetching conversations...');

            const response = await fetch(`${API_URL}/api/conversations`);
            if (!response.ok) throw new Error('Error fetching conversations');

            const data = await response.json();
            // Handle both paginated and legacy response formats
            const conversations = Array.isArray(data) ? data : (data.data || []);
            setConversations(conversations);
            console.log(`✅ Loaded ${conversations.length} conversations`);

            return data;
        } catch (error) {
            console.error('❌ Error fetching conversations:', error);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

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

    // Select a conversation
    const selectConversation = useCallback(async (conversation) => {
        console.log('🎯 Selecting conversation:', conversation.contact.phone);
        setSelectedConversation(conversation);

        if (conversation.unread > 0) {
            await markConversationAsRead(conversation.contact.phone);
        }

        await fetchMessages(conversation.contact.phone);
    }, [fetchMessages]);

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
            const response = await fetch(`${API_URL}/api/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone,
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
        aiStatesByPhone,
        fetchConversations,
        fetchMessages,
        selectConversation,
        sendMessage,
        toggleAI,
        setSelectedConversation
    };
};

export default useConversations;
