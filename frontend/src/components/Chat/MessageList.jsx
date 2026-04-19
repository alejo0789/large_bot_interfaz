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
    const [previewQuote, setPreviewQuote] = useState(null);
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
    const handleQuoteClick = useCallback((replyTo) => {
        if (!replyTo || !replyTo.id) return;
        
        const messageId = replyTo.id;
        
        // 1. Try direct DOM lookup first (msg-ID)
        let element = document.getElementById(`msg-${messageId}`);
        
        // 2. Fallback: Search in the actual messages array for ID match
        if (!element) {
            const foundMessage = messages.find(m => m.whatsapp_id === messageId || m.id === messageId);
            if (foundMessage) {
                const targetId = foundMessage.whatsapp_id || foundMessage.id;
                element = document.getElementById(`msg-${targetId}`);
            }
        }
        
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Apply highlight
            setHighlightedId(messageId);
            
            // Clear highlight after animation
            setTimeout(() => {
                setHighlightedId(null);
            }, 2500);
        } else {
            // 3. Not found in current list - Show the "Floating Window" instead of alert
            console.log(`🔍 Message ${messageId} not found in current view. Showing preview.`);
            setPreviewQuote(replyTo);
        }
    }, [messages]);

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

            {/* Floating Quote Preview Modal */}
            {previewQuote && (
                <div 
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        backdropFilter: 'blur(2px)',
                        padding: '20px'
                    }}
                    onClick={() => setPreviewQuote(null)}
                >
                    <div 
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            padding: '20px',
                            maxWidth: '400px',
                            width: '100%',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                            animation: 'slideUp 0.3s ease-out',
                            position: 'relative'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '12px',
                            borderBottom: '1px solid var(--color-gray-100)',
                            paddingBottom: '8px'
                        }}>
                            <span style={{ 
                                fontWeight: '600', 
                                color: 'var(--color-primary)',
                                fontSize: 'var(--font-size-sm)'
                            }}>
                                📝 Mensaje Original
                            </span>
                            <button 
                                onClick={() => setPreviewQuote(null)}
                                style={{
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    fontSize: '20px',
                                    color: 'var(--color-gray-400)'
                                }}
                            >
                                ×
                            </button>
                        </div>
                        
                        <div style={{ 
                            fontSize: 'var(--font-size-md)',
                            lineHeight: '1.5',
                            color: 'var(--color-gray-800)',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap'
                        }}>
                            <div style={{ 
                                fontSize: 'var(--font-size-xs)', 
                                color: 'var(--color-gray-500)',
                                marginBottom: '4px',
                                fontWeight: '500'
                            }}>
                                {previewQuote.sender || 'Usuario'} escribió:
                            </div>
                            {previewQuote.text || 'Archivo multimedia'}
                        </div>
                        
                        <div style={{ marginTop: '16px', textAlign: 'right' }}>
                            <button 
                                className="btn btn-primary"
                                style={{ padding: '6px 16px', fontSize: '13px' }}
                                onClick={() => setPreviewQuote(null)}
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MessageList;
