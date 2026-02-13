import React, { useMemo } from 'react';
import ConversationItem from './ConversationItem';

/**
 * Conversation list component
 */
const ConversationList = ({
    conversations,
    selectedId,
    searchQuery,
    aiStatesByPhone,
    tagsByPhone = {},
    isLoading,
    onSelect,
    onTagClick
}) => {
    // Filter conversations based on search
    const filteredConversations = useMemo(() => {
        if (!searchQuery) return conversations;

        const query = searchQuery.toLowerCase();
        return conversations.filter(conv =>
            conv.contact.name?.toLowerCase().includes(query) ||
            conv.contact.phone?.includes(query) ||
            conv.lastMessage?.toLowerCase().includes(query)
        );
    }, [conversations, searchQuery]);

    if (isLoading) {
        return (
            <div className="conversation-list flex-center" style={{ padding: 'var(--space-8)' }}>
                <div className="loading">
                    <p style={{ color: 'var(--color-gray-500)' }}>Cargando conversaciones...</p>
                </div>
            </div>
        );
    }

    if (filteredConversations.length === 0) {
        return (
            <div className="conversation-list flex-center" style={{ padding: 'var(--space-8)' }}>
                <div style={{ textAlign: 'center', color: 'var(--color-gray-500)' }}>
                    {searchQuery ? (
                        <>
                            <p>No se encontraron conversaciones</p>
                            <p style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
                                Intenta con otro término de búsqueda
                            </p>
                        </>
                    ) : (
                        <>
                            <p>No hay conversaciones</p>
                            <p style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
                                Las conversaciones aparecerán aquí
                            </p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="conversation-list">
            {filteredConversations.map(conversation => (
                <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedId === conversation.id}
                    aiEnabled={aiStatesByPhone[conversation.contact.phone] ?? true}
                    tags={tagsByPhone[conversation.contact.phone] || []}
                    onClick={() => onSelect(conversation)}
                    onTagClick={onTagClick}
                />
            ))}
        </div>
    );
};

export default ConversationList;
