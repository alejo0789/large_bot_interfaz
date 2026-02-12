import React, { useState, useRef, useEffect } from 'react';
import { Tag, X, Filter, ChevronDown, Calendar, Check } from 'lucide-react';

/**
 * Improved Tag filter component with dropdown and date filter
 */
const TagFilter = ({
    tags,
    selectedTagIds,
    onToggleTag,
    onClearFilter,
    showUnreadOnly,
    onToggleUnreadOnly,
    dateFilter,
    onDateFilterChange,
    unreadCount = 0
}) => {
    const [showTagDropdown, setShowTagDropdown] = useState(false);
    const [showDateDropdown, setShowDateDropdown] = useState(false);
    const tagDropdownRef = useRef(null);
    const dateDropdownRef = useRef(null);

    const hasActiveFilters = selectedTagIds.length > 0 || showUnreadOnly || dateFilter;

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target)) {
                setShowTagDropdown(false);
            }
            if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target)) {
                setShowDateDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Date filter options
    const dateOptions = [
        { id: 'today', label: 'Hoy', days: 0 },
        { id: 'yesterday', label: 'Ayer', days: 1 },
        { id: 'last7', label: 'Últimos 7 días', days: 7 },
        { id: 'last30', label: 'Últimos 30 días', days: 30 },
        { id: 'last90', label: 'Últimos 90 días', days: 90 }
    ];

    const selectedDateOption = dateOptions.find(opt => opt.id === dateFilter);

    return (
        <div style={{
            padding: 'var(--space-2) var(--space-3)',
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
                    fontWeight: 600
                }}>
                    <Filter className="w-3 h-3" />
                    Filtros
                </div>

                {hasActiveFilters && (
                    <button
                        onClick={onClearFilter}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 6px',
                            fontSize: '11px',
                            color: 'var(--color-error)',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 500
                        }}
                    >
                        <X className="w-3 h-3" />
                        Limpiar
                    </button>
                )}
            </div>

            {/* Filter buttons row */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-2)',
                flexWrap: 'wrap'
            }}>
                {/* Unread filter */}
                <button
                    onClick={onToggleUnreadOnly}
                    title={showUnreadOnly ? "Mostrar todos" : "Mostrar solo no leídos"}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        padding: '5px 8px', // Compact padding
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-md)',
                        border: showUnreadOnly
                            ? '1px solid var(--color-primary)'
                            : '1px solid var(--color-gray-300)',
                        backgroundColor: showUnreadOnly
                            ? 'var(--color-primary)' // Solid primary when active
                            : 'var(--color-white)',
                        color: showUnreadOnly
                            ? 'white'
                            : 'var(--color-gray-600)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                    }}
                >
                    {/* Unread Indicator/Count */}
                    {unreadCount > 0 ? (
                        <span style={{
                            backgroundColor: showUnreadOnly ? 'white' : 'var(--color-error)',
                            color: showUnreadOnly ? 'var(--color-primary)' : 'white',
                            borderRadius: '10px',
                            padding: '1px 5px',
                            fontSize: '9px',
                            minWidth: '16px',
                            textAlign: 'center',
                            fontWeight: 700
                        }}>
                            {unreadCount}
                        </span>
                    ) : (
                        <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: showUnreadOnly ? 'white' : 'var(--color-gray-400)'
                        }} />
                    )}

                    <span>No leídos</span>
                </button>

                {/* Tags dropdown */}
                <div ref={tagDropdownRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowTagDropdown(!showTagDropdown)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            fontSize: '11px',
                            fontWeight: 500,
                            borderRadius: 'var(--radius-md)',
                            border: selectedTagIds.length > 0
                                ? '1px solid var(--color-primary)'
                                : '1px solid var(--color-gray-300)',
                            backgroundColor: selectedTagIds.length > 0
                                ? 'rgba(18, 140, 126, 0.1)'
                                : 'var(--color-white)',
                            color: selectedTagIds.length > 0
                                ? 'var(--color-primary)'
                                : 'var(--color-gray-600)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)'
                        }}
                    >
                        <Tag className="w-3 h-3" />
                        Etiquetas
                        {selectedTagIds.length > 0 && (
                            <span style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'white',
                                borderRadius: '50%',
                                width: '16px',
                                height: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: 600
                            }}>
                                {selectedTagIds.length}
                            </span>
                        )}
                        <ChevronDown className="w-3 h-3" style={{
                            transform: showTagDropdown ? 'rotate(180deg)' : 'rotate(0)',
                            transition: 'transform 0.2s'
                        }} />
                    </button>

                    {/* Tags dropdown menu */}
                    {showTagDropdown && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: '4px',
                            minWidth: '200px',
                            maxHeight: '250px',
                            overflowY: 'auto',
                            backgroundColor: 'white',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                            border: '1px solid var(--color-gray-200)',
                            zIndex: 100
                        }}>
                            <div style={{
                                padding: '8px',
                                borderBottom: '1px solid var(--color-gray-100)',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--color-gray-500)'
                            }}>
                                Seleccionar etiquetas
                            </div>

                            {tags.length === 0 ? (
                                <div style={{
                                    padding: '12px',
                                    fontSize: '12px',
                                    color: 'var(--color-gray-400)',
                                    textAlign: 'center',
                                    fontStyle: 'italic'
                                }}>
                                    Sin etiquetas disponibles
                                </div>
                            ) : (
                                tags.map(tag => {
                                    const isSelected = selectedTagIds.includes(tag.id);
                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() => onToggleTag(tag.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                width: '100%',
                                                padding: '10px 12px',
                                                fontSize: '13px',
                                                backgroundColor: isSelected ? 'var(--color-gray-50)' : 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.15s',
                                                textAlign: 'left'
                                            }}
                                            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-gray-50)'}
                                            onMouseLeave={(e) => e.target.style.backgroundColor = isSelected ? 'var(--color-gray-50)' : 'transparent'}
                                        >
                                            {/* Color indicator */}
                                            <span style={{
                                                width: '14px',
                                                height: '14px',
                                                borderRadius: '4px',
                                                backgroundColor: tag.color,
                                                flexShrink: 0,
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                            }} />

                                            {/* Tag name */}
                                            <span style={{
                                                flex: 1,
                                                color: 'var(--color-gray-700)',
                                                fontWeight: isSelected ? 600 : 400
                                            }}>
                                                {tag.name}
                                            </span>

                                            {/* Check icon if selected */}
                                            {isSelected && (
                                                <Check
                                                    className="w-4 h-4"
                                                    style={{ color: 'var(--color-primary)' }}
                                                />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Date filter dropdown */}
                <div ref={dateDropdownRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowDateDropdown(!showDateDropdown)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            fontSize: '11px',
                            fontWeight: 500,
                            borderRadius: 'var(--radius-md)',
                            border: dateFilter
                                ? '1px solid var(--color-primary)'
                                : '1px solid var(--color-gray-300)',
                            backgroundColor: dateFilter
                                ? 'rgba(18, 140, 126, 0.1)'
                                : 'var(--color-white)',
                            color: dateFilter
                                ? 'var(--color-primary)'
                                : 'var(--color-gray-600)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)'
                        }}
                    >
                        <Calendar className="w-3 h-3" />
                        {selectedDateOption ? selectedDateOption.label : 'Fecha'}
                        <ChevronDown className="w-3 h-3" style={{
                            transform: showDateDropdown ? 'rotate(180deg)' : 'rotate(0)',
                            transition: 'transform 0.2s'
                        }} />
                    </button>

                    {/* Date dropdown menu */}
                    {showDateDropdown && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: '4px',
                            minWidth: '160px',
                            backgroundColor: 'white',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                            border: '1px solid var(--color-gray-200)',
                            zIndex: 100
                        }}>
                            <div style={{
                                padding: '8px',
                                borderBottom: '1px solid var(--color-gray-100)',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--color-gray-500)'
                            }}>
                                Filtrar por fecha
                            </div>

                            {/* "All dates" option */}
                            <button
                                onClick={() => {
                                    onDateFilterChange && onDateFilterChange(null);
                                    setShowDateDropdown(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    fontSize: '13px',
                                    backgroundColor: !dateFilter ? 'var(--color-gray-50)' : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <span style={{ flex: 1, color: 'var(--color-gray-700)' }}>
                                    Todas las fechas
                                </span>
                                {!dateFilter && (
                                    <Check className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                                )}
                            </button>

                            {dateOptions.map(option => (
                                <button
                                    key={option.id}
                                    onClick={() => {
                                        onDateFilterChange && onDateFilterChange(option.id);
                                        setShowDateDropdown(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        width: '100%',
                                        padding: '10px 12px',
                                        fontSize: '13px',
                                        backgroundColor: dateFilter === option.id ? 'var(--color-gray-50)' : 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    <span style={{
                                        flex: 1,
                                        color: 'var(--color-gray-700)',
                                        fontWeight: dateFilter === option.id ? 600 : 400
                                    }}>
                                        {option.label}
                                    </span>
                                    {dateFilter === option.id && (
                                        <Check className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Active filters summary */}
            {(selectedTagIds.length > 0) && (
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px',
                    marginTop: 'var(--space-2)'
                }}>
                    {selectedTagIds.map(tagId => {
                        const tag = tags.find(t => t.id === tagId);
                        if (!tag) return null;
                        return (
                            <span
                                key={tagId}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    borderRadius: 'var(--radius-full)',
                                    backgroundColor: tag.color,
                                    color: 'white'
                                }}
                            >
                                {tag.name}
                                <X
                                    className="w-3 h-3"
                                    style={{ cursor: 'pointer', opacity: 0.8 }}
                                    onClick={() => onToggleTag(tagId)}
                                />
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TagFilter;
