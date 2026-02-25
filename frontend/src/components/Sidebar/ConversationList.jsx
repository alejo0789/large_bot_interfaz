import React, { useMemo, useRef, useEffect, useLayoutEffect } from 'react';
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
    onStartNewChat,
    onDelete,
    onTogglePin,
    globalDefaultAi = true,
    // Multi-selection props
    isSelectionMode = false,
    selectedIds = [],
    onToggleSelection,
    onEnterSelectionMode
}) => {
    const listRef = useRef(null);
    const [refreshing, setRefreshing] = React.useState(false);
    const [pullDistance, setPullDistance] = React.useState(0);
    const touchStartRef = useRef(0);
    const isPullingRef = useRef(false);

    // Filter conversations based on search (handled by backend now)
    const filteredConversations = useMemo(() => {
        return conversations;
    }, [conversations]);

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

    const previousSelectedIdRef = useRef(null);

    // Auto-scroll to selected conversation - ONLY when selecting a NEW one
    useEffect(() => {
        if (selectedId && listRef.current && selectedId !== previousSelectedIdRef.current) {
            const currentSelected = selectedId;
            const prevSelected = previousSelectedIdRef.current;

            // Only scroll if it's a truly different conversation being selected
            if (currentSelected !== prevSelected) {
                const timeout = setTimeout(() => {
                    if (listRef.current) {
                        const activeItem = listRef.current.querySelector('.conversation-item.active');
                        if (activeItem) {
                            activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }
                }, 100);

                previousSelectedIdRef.current = currentSelected;
                return () => clearTimeout(timeout);
            }
        } else if (!selectedId) {
            previousSelectedIdRef.current = null;
        }
    }, [selectedId]);

    // Scroll Anchoring: keep the sidebar "quiet" when items move to top
    const prevTopConversationId = useRef(conversations[0]?.id || conversations[0]?.contact?.phone);
    const prevConversationsCount = useRef(conversations.length);

    useLayoutEffect(() => {
        if (listRef.current && conversations.length > 0 && conversations.length === prevConversationsCount.current) {
            const currentTopId = conversations[0]?.id || conversations[0]?.contact?.phone;

            // If the top item changed, but it wasn't a new fetch (same count),
            // it means a conversation reordered to the top.
            if (currentTopId !== prevTopConversationId.current && listRef.current.scrollTop > 20) {
                // Get the height of the first item to compensate exactly
                if (listRef.current) {
                    const firstItem = listRef.current.querySelector('.conversation-item-wrapper');
                    if (firstItem) {
                        const height = firstItem.offsetHeight;
                        listRef.current.scrollTop += height;
                    }
                }
            }
        }
        prevTopConversationId.current = conversations[0]?.id || conversations[0]?.contact?.phone;
        prevConversationsCount.current = conversations.length;
    }, [conversations]);

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
            style={{ position: 'relative', overflowAnchor: 'none' }}
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
                <div key={conversation.id} data-id={conversation.id} className="conversation-item-wrapper">
                    <ConversationItem
                        conversation={conversation}
                        isSelected={selectedId === conversation.id}
                        isMultiSelected={selectedIds.includes(conversation.id)}
                        isSelectionMode={isSelectionMode}
                        onToggleSelection={onToggleSelection}
                        onEnterSelectionMode={onEnterSelectionMode}
                        aiEnabled={aiStatesByPhone[conversation.contact.phone] ?? globalDefaultAi}
                        tags={conversation.tags || tagsByPhone[conversation.contact.phone] || []}
                        onClick={() => isSelectionMode ? onToggleSelection(conversation.id) : onSelect(conversation)}
                        onTagClick={onTagClick}
                        onDelete={onDelete}
                        onTogglePin={onTogglePin}
                    />
                </div>
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
