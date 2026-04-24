import React, { useMemo, useRef, useEffect } from 'react';
import ConversationItem from './ConversationItem';
import { UserPlus } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';

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
    const [refreshing, setRefreshing] = React.useState(false);
    const [pullDistance, setPullDistance] = React.useState(0);
    const touchStartRef = useRef(0);
    const isPullingRef = useRef(false);
    const virtuosoRef = useRef(null);
    const listContainerRef = useRef(null);

    // Filter conversations based on search (handled by backend now)
    const filteredConversations = useMemo(() => {
        return conversations;
    }, [conversations]);

    const previousSelectedIdRef = useRef(null);

    // Auto-scroll to selected conversation - ONLY when selecting a NEW one
    useEffect(() => {
        if (selectedId && selectedId !== previousSelectedIdRef.current) {
            const currentSelected = selectedId;
            const prevSelected = previousSelectedIdRef.current;

            // Only scroll if it's a truly different conversation being selected
            if (currentSelected !== prevSelected) {
                const index = filteredConversations.findIndex(c => c.id === currentSelected);
                if (index !== -1 && virtuosoRef.current) {
                    // Small timeout to ensure Virtuoso has processed items
                    setTimeout(() => {
                        virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' });
                    }, 50);
                }
                previousSelectedIdRef.current = currentSelected;
            }
        } else if (!selectedId) {
            previousSelectedIdRef.current = null;
        }
    }, [selectedId, filteredConversations]);

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
        // Solo permitir pull-to-refresh si el scroll principal está arriba
        const scrollContainer = listContainerRef.current?.querySelector('[data-virtuoso-scroller]');
        if (scrollContainer && scrollContainer.scrollTop <= 0) {
            touchStartRef.current = e.touches[0].clientY;
            isPullingRef.current = true;
        }
    };

    const handleTouchMove = (e) => {
        if (!isPullingRef.current) return;

        const touchY = e.touches[0].clientY;
        const distance = touchY - touchStartRef.current;

        if (distance > 0) {
            const pull = Math.min(distance * 0.4, 80);
            setPullDistance(pull);

            if (pull > 10) {
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

    const loadMore = () => {
        if (hasMore && !isLoadingMore && onLoadMore) {
            onLoadMore();
        }
    };

    return (
        <div
            className="conversation-list"
            ref={listContainerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ position: 'relative', overflowAnchor: 'none', display: 'flex', flexDirection: 'column' }}
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
                fontWeight: '600',
                flexShrink: 0
            }}>
                {pullDistance > 55 ? 'Suelta para actualizar' : 'Tira para actualizar'}
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
                <Virtuoso
                    ref={virtuosoRef}
                    style={{ height: '100%' }}
                    data={filteredConversations}
                    endReached={loadMore}
                    overscan={200} // Cargar algo más para smooth scroll
                    itemContent={(index, conversation) => (
                        <div data-id={conversation.id} className="conversation-item-wrapper" style={{ paddingBottom: '1px' }}>
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
                    )}
                    components={{
                        Footer: () => {
                            if (!hasMore && filteredConversations.length > 0) {
                                return (
                                    <div style={{
                                        padding: 'var(--space-4)',
                                        textAlign: 'center',
                                        color: 'var(--color-gray-400)',
                                        fontSize: 'var(--font-size-xs)'
                                    }}>
                                        No hay más conversaciones
                                    </div>
                                );
                            }
                            
                            if (isLoadingMore) {
                                return (
                                    <div style={{
                                        padding: 'var(--space-4)',
                                        textAlign: 'center',
                                        color: 'var(--color-gray-500)',
                                        fontSize: 'var(--font-size-sm)'
                                    }}>
                                        <div className="loading">Cargando más...</div>
                                    </div>
                                );
                            }
                            
                            return null;
                        }
                    }}
                />
            </div>
        </div>
    );
});

export default ConversationList;
