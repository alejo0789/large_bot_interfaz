import React, { useRef, useEffect, useLayoutEffect, useMemo, useCallback, useState } from 'react';
import MessageBubble from './MessageBubble';
import DateSeparator from './DateSeparator';
import { groupMessagesByDate } from '../../utils/dateUtils';

/**
 * Message list component with date grouping + scroll-to-top pagination
 */
const MessageList = ({
    messages,
    isLoading,
    onForward,
    onReact,
    onDelete,
    onReply,
    onEdit,
    onSchedule,
    onPhoneClick,
    // Older-message pagination props
    onLoadOlder,
    hasMoreOlder,
    isLoadingOlder
}) => {
    const listRef = useRef(null);
    const messagesEndRef = useRef(null);
    const prevMessageCountRef = useRef(0);
    const prevScrollHeightRef = useRef(0);
    const isInitialLoadRef = useRef(true);

    // Group messages by date
    const groupedMessages = useMemo(() => {
        if (!messages || !Array.isArray(messages)) return {};
        return groupMessagesByDate(messages);
    }, [messages]);

    // Get sorted date keys
    const sortedDateKeys = useMemo(() => {
        return Object.keys(groupedMessages).sort((a, b) => {
            if (a === 'unknown') return -1;
            if (b === 'unknown') return 1;
            return new Date(a) - new Date(b);
        });
    }, [groupedMessages]);

    // --- SCROLL MANAGEMENT ---
    
    // To maintain scroll position when prepending messages, we use useLayoutEffect
    const [highlightedId, setHighlightedId] = useState(null);
    const isAddingOlderRef = useRef(false);

    // Detect when messages are prepended (length increase)
    useEffect(() => {
        if (isLoadingOlder) {
            isAddingOlderRef.current = true;
        }
    }, [isLoadingOlder]);

    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list) return;

        // Initial load: scroll to bottom
        if (isInitialLoadRef.current && messages && messages.length > 0) {
            list.scrollTop = list.scrollHeight;
            isInitialLoadRef.current = false;
            prevScrollHeightRef.current = list.scrollHeight;
            prevMessageCountRef.current = messages.length;
            return;
        }

        const currentCount = messages ? messages.length : 0;
        const newScrollHeight = list.scrollHeight;
        const countDiff = currentCount - prevMessageCountRef.current;
        const heightDiff = newScrollHeight - prevScrollHeightRef.current;

        // Case 1: Older messages loaded (prepended)
        if (countDiff > 0 && isAddingOlderRef.current) {
            list.scrollTop = list.scrollTop + heightDiff;
            isAddingOlderRef.current = false;
        } 
        // Case 2: New messages arrived (appended)
        else if (countDiff > 0) {
            const isNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 300;
            const lastMsg = messages[messages.length - 1];
            const wasSentByMe = lastMsg?.sender === 'agent' || lastMsg?.agentId;

            if (isNearBottom || wasSentByMe) {
                list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
            }
        }

        prevScrollHeightRef.current = newScrollHeight;
        prevMessageCountRef.current = currentCount;
    }, [messages, isLoadingOlder]);

    // Reset initial load status when the message list becomes empty (new conversation)
    useEffect(() => {
        if (!messages || messages.length === 0) {
            isInitialLoadRef.current = true;
            prevMessageCountRef.current = 0;
            prevScrollHeightRef.current = 0;
        }
    }, [messages]);

    // Detect scroll to top → load older messages
    const handleScroll = useCallback(() => {
        const list = listRef.current;
        if (!list || !onLoadOlder || !hasMoreOlder || isLoadingOlder) return;

        if (list.scrollTop < 80) {
            // Save scroll height before loading
            prevScrollHeightRef.current = list.scrollHeight;
            onLoadOlder();
        }
    }, [onLoadOlder, hasMoreOlder, isLoadingOlder]);

    // Handle clicking a quote to scroll to original message
    const handleQuoteClick = useCallback((messageId) => {
        if (!messageId) return;
        
        // Find the element with the message ID
        const element = document.getElementById(`msg-${messageId}`);
        
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Apply highlight
            setHighlightedId(messageId);
            
            // Clear highlight after animation
            setTimeout(() => {
                setHighlightedId(null);
            }, 2500);
        } else {
            console.warn(`🔍 Message ${messageId} not found in current view`);
        }
    }, []);

    if (isLoading) {
        return (
            <div className="chat-messages flex-center" style={{ height: '100%' }}>
                <div className="loading">
                    <p style={{ color: 'var(--color-gray-500)' }}>Cargando mensajes...</p>
                </div>
            </div>
        );
    }

    if (!messages || messages.length === 0) {
        return (
            <div className="chat-messages flex-center" style={{ height: '100%' }}>
                <div style={{ textAlign: 'center', color: 'var(--color-gray-500)' }}>
                    <p>No hay mensajes en esta conversación</p>
                    <p style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
                        Envía un mensaje para iniciar
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="chat-messages"
            ref={listRef}
            onScroll={handleScroll}
        >
            {/* Load-older indicator at the top */}
            {isLoadingOlder && (
                <div style={{
                    textAlign: 'center',
                    padding: '8px',
                    color: 'var(--color-gray-500)',
                    fontSize: 'var(--font-size-sm)'
                }}>
                    <span>Cargando mensajes anteriores...</span>
                </div>
            )}
            {!hasMoreOlder && messages?.length > 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '6px',
                    color: 'var(--color-gray-400)',
                    fontSize: 'var(--font-size-xs)'
                }}>
                    Inicio de la conversación
                </div>
            )}

            {sortedDateKeys.map(dateKey => {
                const group = groupedMessages[dateKey];
                return (
                    <div key={dateKey} className="message-group">
                        <DateSeparator label={group.label} />
                        {group.messages.map((message, index) => {
                            const msgId = message.whatsapp_id || message.id;
                            return (
                                <div 
                                    key={msgId || `${dateKey}-${index}`}
                                    id={`msg-${msgId}`}
                                    className={highlightedId === msgId ? 'message-highlight' : ''}
                                    style={{ borderRadius: '8px', transition: 'transform 0.3s ease' }}
                                >
                                    <MessageBubble
                                        message={message}
                                        onForward={onForward}
                                        onReact={onReact}
                                        onDelete={onDelete}
                                        onReply={onReply}
                                        onEdit={onEdit}
                                        onSchedule={onSchedule}
                                        onPhoneClick={onPhoneClick}
                                        onQuoteClick={handleQuoteClick}
                                    />
                                </div>
                            );
                        })}
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );
};

export default MessageList;
