import React, { useMemo, useRef, useEffect } from 'react';
import ConversationItem from './ConversationItem';
import { UserPlus } from 'lucide-react';

/**
 * Conversation list component with infinite scroll
 */
const ConversationList = React.memo(({
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
    onLoadMore,
    onRefresh,
    onStartNewChat // New prop
}) => {
    const listRef = useRef(null);
    const [refreshing, setRefreshing] = React.useState(false);
    const [pullDistance, setPullDistance] = React.useState(0);
    const touchStartRef = useRef(0);
    const isPullingRef = useRef(false);

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

    const sentinelRef = useRef(null);

    // Infinite scroll using IntersectionObserver
    useEffect(() => {
        if (!hasMore || isLoadingMore || !onLoadMore || !listRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    console.log('🔄 Sentinel visible - loading more conversations...');
                    onLoadMore();
                }
            },
            {
                root: listRef.current, // Use the scrollable list as root
                rootMargin: '400px',   // Start loading when within 400px of bottom
                threshold: 0
            }
        );

        if (sentinelRef.current) {
            observer.observe(sentinelRef.current);
        }

        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, onLoadMore, conversations.length]); // Re-observe when conversations change

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

                            {onStartNewChat && searchQuery.replace(/\D/g, '').length >= 7 && (
                                <button
                                    className="btn btn-primary"
                                    style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', margin: '16px auto' }}
                                    onClick={() => onStartNewChat(searchQuery.replace(/\D/g, ''))}
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Iniciar chat con {searchQuery.replace(/\D/g, '')}
                                </button>
                            )}

                            {(!onStartNewChat || searchQuery.replace(/\D/g, '').length < 7) && (
                                <p style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
                                    Intenta con otro término de búsqueda
                                </p>
                            )}
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

    const handleTouchStart = (e) => {
        if (listRef.current.scrollTop === 0) {
            touchStartRef.current = e.touches[0].clientY;
            isPullingRef.current = true;
        }
    };

    const handleTouchMove = (e) => {
        if (!isPullingRef.current) return;

        const touchY = e.touches[0].clientY;
        const distance = touchY - touchStartRef.current;

        if (distance > 0 && listRef.current.scrollTop === 0) {
            // Prevent default to avoid browser's native pull-to-refresh if possible
            // and apply a resistance factor
            const pull = Math.min(distance * 0.4, 80);
            setPullDistance(pull);

            if (pull > 10) {
                // Prevent standard scroll when pulling down
                if (e.cancelable) e.preventDefault();
            }
        } else if (distance < 0) {
            isPullingRef.current = false;
            setPullDistance(0);
        }
    };

    const handleTouchEnd = () => {
        if (!isPullingRef.current) return;

        if (pullDistance > 60) {
            triggerRefresh();
        }

        isPullingRef.current = false;
        setPullDistance(0);
    };

    const triggerRefresh = async () => {
        if (refreshing || isLoading) return;

        setRefreshing(true);
        if (onRefresh) {
            await onRefresh();
        } else if (window.fetchConversations) {
            await window.fetchConversations();
        }
        setRefreshing(false);
    };

    return (
        <div
            className="conversation-list"
            ref={listRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ position: 'relative' }}
        >
            {/* Pull-to-refresh indicator */}
            <div style={{
                height: `${pullDistance}px`,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--color-gray-50)',
                transition: isPullingRef.current ? 'none' : 'height 0.3s ease',
                opacity: pullDistance / 60,
                fontSize: '0.8rem',
                color: 'var(--color-primary)',
                fontWeight: '600'
            }}>
                {pullDistance > 55 ? 'Suelta para actualizar' : 'Tira para actualizar'}
            </div>
            {filteredConversations.map(conversation => (
                <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedId === conversation.id}
                    aiEnabled={aiStatesByPhone[conversation.contact.phone] ?? true}
                    tags={conversation.tags || tagsByPhone[conversation.contact.phone] || []}
                    onClick={() => onSelect(conversation)}
                    onTagClick={onTagClick}
                />
            ))}

            {/* Sentinel for infinite scroll */}
            {hasMore && <div ref={sentinelRef} style={{ height: '20px' }} />}

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
});

export default ConversationList;
