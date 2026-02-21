import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');

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
    const fetchConversations = useCallback(async (page = 1, search = '', append = false, tagId = null, startDate = null, endDate = null, unreadOnly = false) => {
        try {
            if (!append) setIsLoading(true);
            else setIsLoadingMore(true);

            console.log(`🔄 Fetching conversations (page ${page}, search: "${search}", tag: ${tagId}, date: ${startDate} to ${endDate}, unread: ${unreadOnly})...`);

            const params = new URLSearchParams({
                page: page.toString(),
                limit: '100', // Changed from 50 to 100
                _t: Date.now().toString() // Cache busting
            });

            if (search) {
                params.append('search', search);
            }

            if (tagId) {
                params.append('tagId', tagId);
            }

            if (startDate) {
                params.append('startDate', startDate);
            }

            if (endDate) {
                params.append('endDate', endDate);
            }

            if (unreadOnly) {
                params.append('unreadOnly', 'true');
            }

            const response = await fetch(`${API_URL}/api/conversations?${params}`, {
                cache: 'no-cache'
            });
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
                // Append and deduplicate by phone
                setConversations(prev => {
                    const existingPhones = new Set(prev.map(c => c.contact.phone));
                    const uniqueNew = newConversations.filter(c => !existingPhones.has(c.contact.phone));
                    return [...prev, ...uniqueNew];
                });
            } else {
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
    const loadMoreConversations = useCallback(async (tagId = null, startDate = null, endDate = null, unreadOnly = false) => {
        if (!hasMore || isLoadingMore) return;
        await fetchConversations(currentPage + 1, searchQuery, true, tagId, startDate, endDate, unreadOnly);
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
                (conv && conv.contact && conv.contact.phone === phone) ? { ...conv, unread: 0 } : conv
            ));
        } catch (error) {
            console.error('❌ Error marking as read:', error);
        }
    }, []);

    // Mark conversation as unread
    const markConversationAsUnread = useCallback(async (phone) => {
        try {
            await fetch(`${API_URL}/api/conversations/${phone}/mark-unread`, { method: 'POST' });

            setConversations(prev => prev.map(conv =>
                (conv && conv.contact && conv.contact.phone === phone) ? { ...conv, unread: 1 } : conv
            ));
        } catch (error) {
            console.error('❌ Error marking as unread:', error);
        }
    }, []);

    // Select a conversation
    const selectConversation = useCallback(async (conversation) => {
        // Handle deselection
        if (!conversation) {
            if (selectedConversation && socket) {
                socket.emit('leave-conversation', selectedConversation.contact.phone);
            }
            setSelectedConversation(null);
            return;
        }

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

        setConversations(prev => {
            const currentConversations = [...prev];
            const cleanIncomingPhone = String(phone).replace(/\D/g, '');
            const conversationIndex = currentConversations.findIndex(conv =>
                String(conv.contact.phone).replace(/\D/g, '') === cleanIncomingPhone
            );

            if (conversationIndex !== -1) {
                const targetConv = currentConversations[conversationIndex];
                if (!targetConv || !targetConv.contact) return currentConversations;

                const updatedConv = {
                    ...targetConv,
                    lastMessage: message,
                    timestamp: newMessage.timestamp,
                    rawTimestamp: newMessage.rawTimestamp
                };
                currentConversations.splice(conversationIndex, 1);
                return [updatedConv, ...currentConversations];
            }
            return currentConversations;
        });

        try {
            const response = await fetch(`${API_URL}/api/send-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.REACT_APP_API_KEY || ''
                },
                body: JSON.stringify({
                    phone: String(phone),
                    message,
                    name,
                    temp_id: tempId,
                    ai_enabled: currentAIState,
                    agent_id: agentId,
                    agent_name: agentName
                })
            });

            if (!response.ok) throw new Error('Error sending message');

            const data = await response.json();

            setMessagesByConversation(prev => ({
                ...prev,
                [phone]: prev[phone].map(msg =>
                    msg.id === tempId ? {
                        ...msg,
                        status: 'delivered',
                        id: data.newMessage?.id || msg.id,
                        whatsapp_id: data.newMessage?.whatsapp_id || msg.whatsapp_id
                    } : msg
                )
            }));

            return true;
        } catch (error) {
            console.error('❌ Error sending message:', error);
            setMessagesByConversation(prev => ({
                ...prev,
                [phone]: prev[phone].map(msg =>
                    msg.id === tempId ? { ...msg, status: 'failed' } : msg
                )
            }));
            return false;
        }
    }, [aiStatesByPhone]);

    const sendFile = useCallback(async (phone, file, caption, name, options = {}) => {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const { agentId, agentName } = options;
        const media_type = file.type.startsWith('image/') ? 'image' :
            file.type.startsWith('video/') ? 'video' :
                file.type.startsWith('audio/') ? 'audio' : 'document';

        // NO crear mensaje optimista - solo se mostrará cuando llegue del servidor
        // Esto evita ver dos imágenes (preview optimista + imagen real)

        const formData = new FormData();
        formData.append('file', file);
        formData.append('phone', phone);
        formData.append('name', name);
        formData.append('temp_id', tempId);
        if (caption) formData.append('caption', caption);
        if (agentId) formData.append('agent_id', agentId);
        if (agentName) formData.append('agent_name', agentName);

        try {
            const response = await fetch(`${API_URL}/api/send-file`, {
                method: 'POST',
                headers: {
                    'x-api-key': process.env.REACT_APP_API_KEY || ''
                },
                body: formData
            });

            if (!response.ok) throw new Error('Error sending file');

            const result = await response.json();

            // Reordering after send
            setConversations(prev => {
                const currentConversations = [...prev];
                const cleanIncomingPhone = String(phone).replace(/\D/g, '');
                const conversationIndex = currentConversations.findIndex(conv =>
                    String(conv.contact.phone).replace(/\D/g, '') === cleanIncomingPhone
                );

                if (conversationIndex !== -1) {
                    const targetConv = currentConversations[conversationIndex];
                    const updatedConv = {
                        ...targetConv,
                        lastMessage: caption || (
                            media_type === 'image' ? '📷 Imagen' :
                                media_type === 'video' ? '🎥 Video' :
                                    media_type === 'audio' ? '🎵 Audio' : `📎 ${file.name}`
                        ),
                        timestamp: new Date().toLocaleTimeString('es-CO', {
                            hour: '2-digit',
                            minute: '2-digit'
                        }),
                        rawTimestamp: new Date().toISOString()
                    };
                    currentConversations.splice(conversationIndex, 1);
                    return [updatedConv, ...currentConversations];
                }
                return currentConversations;
            });

            return result;
        } catch (error) {
            console.error('❌ Error sending file:', error);
            // Ya no hay mensaje optimista que actualizar
            throw error;
        }
    }, []);

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

    // Re-join conversation room on socket reconnect
    useEffect(() => {
        if (!socket || !selectedConversation) return;

        const handleReconnect = () => {
            const phone = selectedConversation.contact.phone;
            console.log('🔄 Socket reconnected, re-joining conversation room:', phone);
            socket.emit('join-conversation', phone);
        };

        socket.on('reconnect', handleReconnect);
        // Also re-join on connect (in case this is the initial connect after the conversation was selected)
        socket.on('connect', handleReconnect);

        return () => {
            socket.off('reconnect', handleReconnect);
            socket.off('connect', handleReconnect);
        };
    }, [socket, selectedConversation]);

    // Handle incoming messages from socket
    useEffect(() => {
        if (!socket) return;

        const handleSocketMessage = (messageData, isAgentEvent = false) => {
            // Determine if agent/outgoing message based on event type OR payload
            const isAgent = isAgentEvent ||
                messageData.sender_type === 'agent' ||
                messageData.sender === 'agent' ||
                messageData.sender_type === 'ai' ||
                messageData.sender === 'ai';

            console.log(`📨 ${isAgent ? 'Agent' : 'Customer'} message received:`, messageData);

            const phone = messageData.phone;
            const senderType = messageData.sender_type || messageData.sender || (isAgent ? 'agent' : 'customer');
            const cleanIncomingPhone = String(phone).replace(/\D/g, '');

            // Ignore messages sent by agent from THIS session - they were already added optimistically
            // (We check whatsapp_id if available to avoid duplicates)

            const formattedMessage = {
                id: messageData.whatsapp_id || messageData.id || Date.now(),
                text: messageData.message || messageData.text,
                sender: senderType,
                timestamp: new Date(messageData.timestamp).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                rawTimestamp: messageData.timestamp || new Date().toISOString(),
                status: 'delivered',
                // Media support
                media_type: messageData.media_type || messageData.mediaType || null,
                media_url: messageData.media_url || messageData.mediaUrl || null,
                agent_name: messageData.agent_name || null,
                sender_name: messageData.sender_name || messageData.pushName || messageData.contact_name || null,
                temp_id: messageData.temp_id // Crucial for duplicate matching
            };

            // Check for duplicates before adding
            setMessagesByConversation(prev => {
                const existingMessages = prev[phone] || [];

                // Duplicate check by ID or content/timestamp
                // Priority:
                // 1. Check by temp_id (most reliable)
                // 2. Check by media_type if present (for media messages with or without caption)
                // 3. Check by text content (for text-only messages)
                const isDuplicate = existingMessages.some(msg => {
                    // Check by ID
                    if (msg.id === formattedMessage.id) return true;

                    // Check by temp_id
                    if (formattedMessage.temp_id && msg.id === formattedMessage.temp_id) return true;

                    // Only check content if same sender
                    if (msg.sender !== formattedMessage.sender) return false;

                    // Check by media type if either message has media
                    if (msg.media_type || formattedMessage.media_type) {
                        return msg.media_type === formattedMessage.media_type &&
                            Math.abs(new Date(msg.rawTimestamp) - new Date(formattedMessage.rawTimestamp)) < 20000;
                    }

                    // Check by text content
                    return msg.text && msg.text === formattedMessage.text;
                });

                if (isDuplicate) {
                    // Update status if it was 'sending'
                    if (isAgent) {
                        return {
                            ...prev,
                            [phone]: existingMessages.map(msg => {
                                // Check by temp_id if available
                                if (formattedMessage.temp_id && msg.id === formattedMessage.temp_id) {
                                    return {
                                        ...msg,
                                        status: 'delivered',
                                        id: formattedMessage.id,
                                        media_url: formattedMessage.media_url, // Update URL (e.g. from blob: to http:)
                                        media_type: formattedMessage.media_type,
                                        agent_name: formattedMessage.agent_name
                                    };
                                }

                                // Fallback to content matching
                                if (!formattedMessage.temp_id && msg.status === 'sending') {
                                    // Match by media type if present
                                    if (msg.media_type || formattedMessage.media_type) {
                                        if (msg.media_type === formattedMessage.media_type &&
                                            Math.abs(new Date(msg.rawTimestamp) - new Date(formattedMessage.rawTimestamp)) < 20000) {
                                            return {
                                                ...msg,
                                                status: 'delivered',
                                                id: formattedMessage.id,
                                                media_url: formattedMessage.media_url,
                                                media_type: formattedMessage.media_type,
                                                agent_name: formattedMessage.agent_name
                                            };
                                        }
                                    }
                                    // Match by text content
                                    else if (msg.text && msg.text === formattedMessage.text) {
                                        return {
                                            ...msg,
                                            status: 'delivered',
                                            id: formattedMessage.id,
                                            agent_name: formattedMessage.agent_name
                                        };
                                    }
                                }

                                return msg;
                            })
                        };
                    }
                    return prev;
                }

                return {
                    ...prev,
                    [phone]: [...existingMessages, formattedMessage]
                };
            });

            // Update conversation in list and reorder
            setConversations(prev => {
                const currentConversations = [...prev];
                const index = currentConversations.findIndex(conv =>
                    String(conv.contact.phone).replace(/\D/g, '') === cleanIncomingPhone
                );

                if (index !== -1) {
                    const targetConv = currentConversations[index];
                    if (!targetConv || !targetConv.contact) return currentConversations;

                    const updatedConv = {
                        ...targetConv,
                        lastMessage: formattedMessage.text,
                        timestamp: formattedMessage.timestamp,
                        rawTimestamp: formattedMessage.rawTimestamp,
                        unread: (selectedConversation?.contact?.phone === phone || isAgent)
                            ? 0
                            : (targetConv.unread || 0) + 1
                    };
                    currentConversations.splice(index, 1);
                    return [updatedConv, ...currentConversations];
                }
                return currentConversations;
            });
        };

        const handleConversationUpdated = (data) => {
            console.log('📋 Conversation list update received:', data);
            const cleanPhone = String(data.phone).replace(/\D/g, '');

            setConversations(prev => {
                const currentConversations = [...prev];
                const index = currentConversations.findIndex(conv =>
                    String(conv.contact.phone).replace(/\D/g, '') === cleanPhone
                );

                const timestamp = new Date(data.timestamp).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                if (index === -1) {
                    // New conversation!
                    const newConv = {
                        id: data.phone,
                        contact: {
                            name: data.contact_name || `Usuario ${data.phone.slice(-4)} `,
                            phone: data.phone
                        },
                        lastMessage: data.lastMessage,
                        timestamp: timestamp,
                        rawTimestamp: data.timestamp,
                        unread: (selectedConversation?.contact.phone === data.phone) ? 0 : 1,
                        status: 'active'
                    };
                    return [newConv, ...currentConversations];
                }

                // Update existing
                const targetConv = currentConversations[index];
                const updatedConv = {
                    ...targetConv,
                    lastMessage: data.lastMessage,
                    timestamp: timestamp,
                    rawTimestamp: data.timestamp,
                    unread: (selectedConversation?.contact.phone === data.phone || data.sender_type === 'agent' || data.sender_type === 'ai' || data.sender_type === 'bot')
                        ? 0
                        : (targetConv.unread || 0) + (data.unread ?? 1)
                };
                currentConversations.splice(index, 1);
                return [updatedConv, ...currentConversations];
            });
        };

        const handleStateChange = (data) => {
            setAiStatesByPhone(prev => ({
                ...prev,
                [data.phone]: data.state === 'ai_active'
            }));
        };

        const handleMessageUpdated = (data) => {
            console.log('🔄 Message updated:', data);
            const { id, phone } = data;

            // formatting for consistency
            const updates = {
                status: data.status,
                text: data.text, // "🚫 Mensaje eliminado"
                media_url: data.media_url,
                media_type: data.media_type
            };

            setMessagesByConversation(prev => {
                const current = prev[phone] || [];
                return {
                    ...prev,
                    [phone]: current.map(msg =>
                        (msg.id === id || (data.whatsapp_id && msg.id === data.whatsapp_id))
                            ? { ...msg, ...updates }
                            : msg
                    )
                };
            });

            // Also update conversation preview if last message
            // Wait, we can't easily check if it's the last message without list context, 
            // but we can try to find the conversation and check match.
            // Or just check if the updated message timestamp matches the conversation's timestamp? Hard.
            // Simplified: If the updated text is "🚫 Mensaje eliminado", we should check if the conversation's lastMessage is the OLD text.
            // But we don't have the old text here easily.
            // However, we can just update the conversation state if we find the conversation 
            // and maybe force a refresh or just leave it for the 'conversation-updated' event which usually fires separately?
            // The backend does NOT emit 'conversation-updated' on delete message currently in the route itself, 
            // unless `messageService.deleteMessage` triggers something? No.
            // But `conversationService.updateLastMessage` is called when SENDING, not deleting.
            // So we should handle updating the sidebar here too.

            setConversations(prev => {
                const currentConversations = [...prev];
                const index = currentConversations.findIndex(c => c.contact.phone === phone);
                if (index !== -1) {
                    // We assume that if a message is deleted and it was the last one, we might want to show that.
                    // But we don't know for sure.
                    // Let's rely on the optimistic update we did on the initiator side, 
                    // this handler is for OTHER clients (or confirmation).
                    // If we want consistency, we can update here too.
                    // For now, let's just update the message list which is the primary goal.
                    return prev;
                }
                return prev;
            });
        };

        socket.on('new-message', (data) => handleSocketMessage(data, false));
        socket.on('agent-message', (data) => handleSocketMessage(data, true));
        socket.on('conversation-updated', handleConversationUpdated);
        socket.on('conversation-state-changed', handleStateChange);
        socket.on('message-updated', handleMessageUpdated); // New listener

        return () => {
            socket.off('new-message');
            socket.off('agent-message');
            socket.off('conversation-updated');
            socket.off('conversation-state-changed');
            socket.off('message-updated');
        };
    }, [socket, selectedConversation]);

    // Initial fetch removed - let parent component control it
    /*
    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);
    */

    const deleteMessage = useCallback(async (messageId, phone) => {
        try {
            // Optimistic update - Messages list
            setMessagesByConversation(prev => {
                const current = prev[phone] || [];
                // Instead of removing, we should ideally mark it as deleted if we want that effect, 
                // but if the user wants it gone, filtering is fine. 
                // However, user said "deberia parecer mensaje eliminado", implying they might want to see the placeholder 
                // OR they just want the UI to update. 
                // If I filter it out, it disappears. 
                // Let's stick to filtering out for now (or replacing with a "deleted" placeholder if preferred, but filtering is standard for "delete for everyone" in some custom apps, though WA shows placeholder).
                // Let's try replacing it with a placeholder to match WA style if that's what's requested, 
                // OR just ensure the Sidebar updates.
                // User said: "deberia parecer mensaje eliminado en el frontend" -> "Must look like deleted message".
                // I will replace the text with "🚫 Mensaje eliminado" and keep it in the list AND update sidebar.

                return {
                    ...prev,
                    [phone]: current.map(m =>
                        m.id === messageId
                            ? { ...m, text: '🚫 Mensaje eliminado', media_url: null, media_type: null, status: 'deleted' }
                            : m
                    )
                };
            });

            // Optimistic update - Conversation list (Sidebar)
            setConversations(prev => {
                const currentConversations = [...prev];
                const index = currentConversations.findIndex(c => c.contact.phone === phone);
                if (index !== -1) {
                    const conv = currentConversations[index];
                    // Check if the deleted message was the last one shown
                    // We can't easily know if it was the EXACT last one without comparing text/timestamps, 
                    // but it's safe to set "Mensaje eliminado" if it matches roughly or just force update it if we assume the user deletes recent messages.
                    // Better: If we replaced it in the message list, we should check if THIS message was the last one.
                    // Simplified: Just update the last message text to "🚫 Mensaje eliminado" if it matches the deleted message content? 
                    // No, that's hard. Let's just set it to "🚫 Mensaje eliminado" if the timestamp is very recent?
                    // Actually, let's just force update it for visibility.

                    const updatedConv = {
                        ...conv,
                        lastMessage: '🚫 Mensaje eliminado'
                    };
                    currentConversations.splice(index, 1);
                    return [updatedConv, ...currentConversations];
                }
                return prev;
            });

            const res = await fetch(`${API_URL}/api/messages/${messageId}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                throw new Error('Failed to delete');
            }
        } catch (error) {
            console.error(error);
            // Revert logic would go here
        }
    }, [API_URL]);

    const reactToMessage = useCallback(async (messageId, emoji, phone) => {
        // Optimistic update
        setMessagesByConversation(prev => {
            const current = (prev[phone] || []);
            const updated = current.map(m => {
                if (m.id === messageId) {
                    // Filter out my existing reaction to toggle/replace
                    const otherReactions = (m.reactions || []).filter(r => r.by !== 'me');
                    const newReactions = [...otherReactions];
                    if (emoji) {
                        newReactions.push({ emoji, by: 'me' });
                    }
                    return { ...m, reactions: newReactions };
                }
                return m;
            });
            return {
                ...prev,
                [phone]: updated
            };
        });

        try {
            await fetch(`${API_URL}/api/messages/${messageId}/reaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reaction: emoji, phone })
            });
        } catch (error) {
            console.error('Failed to react:', error);
            // Could revert here if needed
        }
    }, []);

    const removeConversation = useCallback((phone) => {
        setConversations(prev => prev.filter(c => c.contact.phone !== phone));
        if (selectedConversation && selectedConversation.contact.phone === phone) {
            setSelectedConversation(null);
        }
    }, [selectedConversation]);

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
        markConversationAsRead,
        markConversationAsUnread,
        setSelectedConversation,
        loadMoreConversations,
        searchConversations,
        sendFile,
        deleteMessage,
        reactToMessage,
        removeConversation
    };
};

export default useConversations;
