import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
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

    const currentCount = messages?.length || 0;

    // On initial load (or when conversation changes): scroll to bottom
    useEffect(() => {
        if (!messages || messages.length === 0) {
            isInitialLoadRef.current = true;
            prevMessageCountRef.current = 0;
            return;
        }

        if (isInitialLoadRef.current) {
            // Initial load: scroll to bottom instantly
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            const t = setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            }, 150);
            isInitialLoadRef.current = false;
            prevMessageCountRef.current = currentCount;
            return () => clearTimeout(t);
        }

        // New messages appended at the bottom (incoming/sent): scroll to bottom
        if (currentCount > prevMessageCountRef.current) {
            const added = currentCount - prevMessageCountRef.current;
            // Only auto-scroll if messages were added at the END (not prepended older ones)
            // If scroll height changed significantly at the top, it's older messages — don't scroll
            const list = listRef.current;
            if (list) {
                const isNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 200;
                if (isNearBottom || added <= 3) {
                    // Likely a new incoming/sent message — scroll down
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }
                // else: user scrolled up to read history; don't hijack scroll
            }
        }

        prevMessageCountRef.current = currentCount;
    }, [messages, currentCount]);

    // Scroll anchor: when older messages get prepended, maintain scroll position
    useEffect(() => {
        const list = listRef.current;
        if (!list) return;

        const newScrollHeight = list.scrollHeight;
        const diff = newScrollHeight - prevScrollHeightRef.current;

        // Only compensate if we were near the top (loading older messages)
        if (prevScrollHeightRef.current > 0 && diff > 0 && list.scrollTop < 100) {
            list.scrollTop = diff;
        }

        prevScrollHeightRef.current = newScrollHeight;
    }, [currentCount]);

    // Reset on conversation change (detect by message array reference changing to smaller set)
    useEffect(() => {
        if (currentCount <= 50) {
            isInitialLoadRef.current = true;
        }
    }, [currentCount]);

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
            {!hasMoreOlder && currentCount > 0 && (
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
                        {group.messages.map((message, index) => (
                            <MessageBubble
                                key={message.id || `${dateKey}-${index}`}
                                message={message}
                                onForward={onForward}
                                onReact={onReact}
                                onDelete={onDelete}
                                onReply={onReply}
                                onEdit={onEdit}
                                onSchedule={onSchedule}
                                onPhoneClick={onPhoneClick}
                            />
                        ))}
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );
};

export default MessageList;
