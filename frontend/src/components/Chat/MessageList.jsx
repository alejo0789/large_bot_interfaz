import React, { useRef, useEffect, useMemo } from 'react';
import MessageBubble from './MessageBubble';
import DateSeparator from './DateSeparator';
import { groupMessagesByDate } from '../../utils/dateUtils';

/**
 * Message list component with date grouping
 */
const MessageList = ({ messages, isLoading }) => {
    const messagesEndRef = useRef(null);

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

    // Auto scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        <div className="chat-messages">
            {sortedDateKeys.map(dateKey => {
                const group = groupedMessages[dateKey];
                return (
                    <div key={dateKey} className="message-group">
                        <DateSeparator label={group.label} />
                        {group.messages.map((message, index) => (
                            <MessageBubble
                                key={message.id || `${dateKey}-${index}`}
                                message={message}
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
