import React, { useMemo, useRef, useEffect } from 'react';
import ConversationItem from './ConversationItem';

/**
 * Conversation list component with infinite scroll
 */
const ConversationList = ({
    conversations,
    selectedId,
    searchQuery,
    aiStatesByPhone,
    tagsByPhone = {},
    isLoading,
    isLoadingMore,
    hasMore,
    onSelect,
    onTagClick,
    onLoadMore
}) => {
    const listRef = useRef(null);

    // Filter conversations based on search (client-side for already loaded)
    const filteredConversations = useMemo(() => {
        if (!searchQuery) return conversations;

        const query = searchQuery.toLowerCase();
        return conversations.filter(conv =>
            conv.contact.name?.toLowerCase().includes(query) ||
            conv.contact.phone?.includes(query) ||
            conv.lastMessage?.toLowerCase().includes(query)
        );
    }, [conversations, searchQuery]);

    // Infinite scroll using IntersectionObserver
    useEffect(() => {
        if (!hasMore || isLoadingMore || !onLoadMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    console.log('🔄 Sentinel visible - loading more conversations...');
                    onLoadMore();
                }
            },
            { threshold: 0.1 }
        );

        const sentinel = document.getElementById('conversation-list-sentinel');
        if (sentinel) {
            observer.observe(sentinel);
        }

        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, onLoadMore]);

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
        <div className="conversation-list" ref={listRef}>
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

            {/* Sentinel for infinite scroll */}
            {hasMore && <div id="conversation-list-sentinel" style={{ height: '20px' }} />}

            {/* Loading more indicator */}
            {isLoadingMore && (
                <div style={{
                    padding: 'var(--space-4)',
                    textAlign: 'center',
                    color: 'var(--color-gray-500)',
                    fontSize: 'var(--font-size-sm)'
                }}>
                    <div className="loading">Cargando más...</div>
                </div>
            )}

            {/* End of list indicator */}
            {!hasMore && filteredConversations.length > 0 && (
                <div style={{
                    padding: 'var(--space-4)',
                    textAlign: 'center',
                    color: 'var(--color-gray-400)',
                    fontSize: 'var(--font-size-xs)'
                }}>
                    No hay más conversaciones
                </div>
            )}
        </div>
    );
};

export default ConversationList;
