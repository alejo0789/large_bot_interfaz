import React from 'react';
import { Tag, X, Filter } from 'lucide-react';

/**
 * Tag filter component for filtering conversations by tags
 */
const TagFilter = ({
    tags,
    selectedTagIds,
    onToggleTag,
    onClearFilter,
    showUnreadOnly,
    onToggleUnreadOnly
}) => {
    const hasActiveFilters = selectedTagIds.length > 0 || showUnreadOnly;

    return (
        <div style={{
            padding: 'var(--space-2) var(--space-4)',
            borderBottom: '1px solid var(--color-gray-200)',
            backgroundColor: 'var(--color-gray-50)'
        }}>
            {/* Filter header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--space-2)'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-gray-600)',
                    fontWeight: 500
                }}>
                    <Filter className="w-3 h-3" />
                    Filtrar por:
                </div>

                {hasActiveFilters && (
                    <button
                        onClick={onClearFilter}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-1)',
                            padding: '2px 6px',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-error)',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <X className="w-3 h-3" />
                        Limpiar
                    </button>
                )}
            </div>

            {/* Unread filter */}
            <div style={{ marginBottom: 'var(--space-2)' }}>
                <button
                    onClick={onToggleUnreadOnly}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        padding: '4px 8px',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 500,
                        borderRadius: 'var(--radius-full)',
                        border: showUnreadOnly
                            ? '1px solid var(--color-primary)'
                            : '1px solid var(--color-gray-300)',
                        backgroundColor: showUnreadOnly
                            ? 'rgba(18, 140, 126, 0.1)'
                            : 'var(--color-white)',
                        color: showUnreadOnly
                            ? 'var(--color-primary)'
                            : 'var(--color-gray-600)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                    }}
                >
                    <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-primary-light)'
                    }} />
                    No leídos
                </button>
            </div>

            {/* Tags */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-1)'
            }}>
                {tags.map(tag => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                        <button
                            key={tag.id}
                            onClick={() => onToggleTag(tag.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-1)',
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: 500,
                                borderRadius: 'var(--radius-full)',
                                border: isSelected
                                    ? `2px solid ${tag.color}`
                                    : '1px solid var(--color-gray-300)',
                                backgroundColor: isSelected
                                    ? tag.color
                                    : 'var(--color-white)',
                                color: isSelected
                                    ? '#fff'
                                    : 'var(--color-gray-600)',
                                cursor: 'pointer',
                                transition: 'all var(--transition-fast)'
                            }}
                        >
                            <Tag className="w-3 h-3" />
                            {tag.name}
                        </button>
                    );
                })}

                {tags.length === 0 && (
                    <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-gray-400)',
                        fontStyle: 'italic'
                    }}>
                        Sin etiquetas
                    </span>
                )}
            </div>
        </div>
    );
};

export default TagFilter;
