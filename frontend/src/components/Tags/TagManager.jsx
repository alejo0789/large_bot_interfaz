import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Tag, EyeOff, Search, ChevronDown, Check } from 'lucide-react';
import TagBadge from './TagBadge';

const TAG_COLORS = [
    { name: 'Rojo', value: '#EF4444' },
    { name: 'Naranja', value: '#F97316' },
    { name: 'Amarillo', value: '#EAB308' },
    { name: 'Verde', value: '#22C55E' },
    { name: 'Azul', value: '#3B82F6' },
    { name: 'Morado', value: '#8B5CF6' },
    { name: 'Rosa', value: '#EC4899' },
    { name: 'Gris', value: '#6B7280' },
];

/**
 * Tag manager modal component
 */
const TagManager = ({
    isOpen,
    onClose,
    tags,
    conversationPhone,
    conversationTags = [],
    onCreateTag,
    onAssignTag,
    onRemoveTag,
    onMarkUnread,
    onUpdateTag,
    isBulk = false,
    bulkPhones = []
}) => {
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0].value);
    const [isCreating, setIsCreating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const searchRef = useRef(null);

    // Cerrar dropdown al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Enfocar buscador cuando se abre el dropdown
    useEffect(() => {
        if (dropdownOpen && searchRef.current) {
            setTimeout(() => searchRef.current?.focus(), 50);
        }
    }, [dropdownOpen]);

    if (!isOpen) return null;

    const handleMarkUnread = async () => {
        if (onMarkUnread) {
            if (isBulk && bulkPhones.length > 0) {
                for (const phone of bulkPhones) {
                    await onMarkUnread(phone);
                }
            } else {
                await onMarkUnread(conversationPhone);
            }
            onClose();
        }
    };

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return;
        try {
            await onCreateTag(newTagName.trim(), newTagColor);
            setNewTagName('');
            setIsCreating(false);
        } catch (error) {
            console.error('Error creating tag:', error);
        }
    };

    const handleAssignTag = async (tagId) => {
        try {
            if (isBulk && bulkPhones.length > 0) {
                for (const phone of bulkPhones) {
                    await onAssignTag(phone, tagId);
                }
            } else {
                await onAssignTag(conversationPhone, tagId);
            }
        } catch (error) {
            console.error('Error assigning tag:', error);
        }
    };

    const handleRemoveTag = async (tagId) => {
        try {
            if (isBulk && bulkPhones.length > 0) {
                for (const phone of bulkPhones) {
                    await onRemoveTag(phone, tagId);
                }
            } else {
                await onRemoveTag(conversationPhone, tagId);
            }
        } catch (error) {
            console.error('Error removing tag:', error);
        }
    };

    const assignedTagIds = conversationTags.map(t => t.id);

    // Todas las etiquetas disponibles (no asignadas), ordenadas alfabéticamente
    const availableTags = tags
        .filter(t => !assignedTagIds.includes(t.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    // Filtradas por búsqueda dentro del dropdown
    const filteredTags = availableTags.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{
                    maxWidth: '420px',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '85vh',
                    overflow: 'hidden',
                }}
            >
                {/* ── HEADER (fijo) ── */}
                <div className="modal-header" style={{ flexShrink: 0 }}>
                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Tag className="w-5 h-5" />
                        {isBulk ? `Etiquetar ${bulkPhones.length} chats` : 'Gestionar Etiquetas'}
                    </h3>
                    <button className="btn btn-icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── BODY (scrollable) ── */}
                <div
                    className="modal-body"
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: 'var(--space-4)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-4)',
                    }}
                >
                    {/* Etiquetas asignadas */}
                    {conversationTags.length > 0 && (
                        <div>
                            <SectionLabel>Etiquetas asignadas</SectionLabel>
                            <div className="tags-container" style={{ marginTop: 'var(--space-2)' }}>
                                {[...conversationTags]
                                    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                                    .map(tag => (
                                        <TagBadge
                                            key={tag.id}
                                            tag={tag}
                                            onRemove={() => handleRemoveTag(tag.id)}
                                        />
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* Dropdown para agregar etiquetas */}
                    {availableTags.length > 0 && (
                        <div>
                            <SectionLabel>Agregar etiqueta</SectionLabel>
                            <div
                                ref={dropdownRef}
                                style={{ position: 'relative', marginTop: 'var(--space-2)' }}
                            >
                                {/* Trigger */}
                                <button
                                    onClick={() => setDropdownOpen(prev => !prev)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '9px 12px',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1.5px solid var(--color-gray-300)',
                                        backgroundColor: 'var(--color-white)',
                                        cursor: 'pointer',
                                        fontSize: 'var(--font-size-sm)',
                                        color: 'var(--color-gray-600)',
                                        transition: 'border-color 0.15s, box-shadow 0.15s',
                                        ...(dropdownOpen && {
                                            borderColor: 'var(--color-primary)',
                                            boxShadow: '0 0 0 3px rgba(18,140,126,0.1)',
                                        }),
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Tag size={14} style={{ color: 'var(--color-gray-400)' }} />
                                        Seleccionar etiqueta…
                                    </span>
                                    <ChevronDown
                                        size={16}
                                        style={{
                                            color: 'var(--color-gray-400)',
                                            transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                            transition: 'transform 0.2s',
                                        }}
                                    />
                                </button>

                                {/* Panel desplegable */}
                                {dropdownOpen && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: 'calc(100% + 6px)',
                                            left: 0,
                                            right: 0,
                                            backgroundColor: 'var(--color-white)',
                                            border: '1.5px solid var(--color-gray-200)',
                                            borderRadius: 'var(--radius-lg)',
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                            zIndex: 300,
                                            overflow: 'hidden',
                                            animation: 'slideUp 0.15s ease',
                                        }}
                                    >
                                        {/* Buscador interno */}
                                        <div style={{
                                            padding: '8px',
                                            borderBottom: '1px solid var(--color-gray-100)',
                                            position: 'relative',
                                        }}>
                                            <Search
                                                size={14}
                                                style={{
                                                    position: 'absolute',
                                                    left: '20px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    color: 'var(--color-gray-400)',
                                                }}
                                            />
                                            <input
                                                ref={searchRef}
                                                type="text"
                                                placeholder="Buscar etiqueta…"
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '6px 8px 6px 32px',
                                                    border: '1px solid var(--color-gray-200)',
                                                    borderRadius: 'var(--radius-md)',
                                                    fontSize: 'var(--font-size-sm)',
                                                    outline: 'none',
                                                    backgroundColor: 'var(--color-gray-50)',
                                                    boxSizing: 'border-box',
                                                }}
                                                onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                                                onBlur={e => e.target.style.borderColor = 'var(--color-gray-200)'}
                                            />
                                        </div>

                                        {/* Lista de etiquetas */}
                                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                            {filteredTags.length === 0 ? (
                                                <div style={{
                                                    padding: '12px 16px',
                                                    fontSize: 'var(--font-size-sm)',
                                                    color: 'var(--color-gray-500)',
                                                    textAlign: 'center',
                                                }}>
                                                    Sin resultados
                                                </div>
                                            ) : (
                                                filteredTags.map(tag => (
                                                    <button
                                                        key={tag.id}
                                                        onClick={() => {
                                                            handleAssignTag(tag.id);
                                                            setDropdownOpen(false);
                                                            setSearchQuery('');
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            padding: '9px 14px',
                                                            border: 'none',
                                                            background: 'none',
                                                            cursor: 'pointer',
                                                            textAlign: 'left',
                                                            fontSize: 'var(--font-size-sm)',
                                                            color: 'var(--color-gray-800)',
                                                            transition: 'background 0.1s',
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-gray-50)'}
                                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                    >
                                                        {/* Pastilla de color */}
                                                        <span style={{
                                                            width: '10px',
                                                            height: '10px',
                                                            borderRadius: '50%',
                                                            backgroundColor: tag.color,
                                                            flexShrink: 0,
                                                        }} />
                                                        {tag.name}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Sin etiquetas disponibles */}
                    {availableTags.length === 0 && conversationTags.length > 0 && (
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-500)' }}>
                            Todas las etiquetas están asignadas.
                        </p>
                    )}

                    {/* Crear nueva etiqueta */}
                    <div style={{
                        borderTop: '1px solid var(--color-gray-100)',
                        paddingTop: 'var(--space-4)',
                    }}>
                        <SectionLabel>Crear nueva etiqueta</SectionLabel>
                        <div style={{ marginTop: 'var(--space-2)' }}>
                            {isCreating ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Nombre de la etiqueta"
                                        value={newTagName}
                                        onChange={(e) => setNewTagName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleCreateTag();
                                            if (e.key === 'Escape') setIsCreating(false);
                                        }}
                                        style={{ paddingLeft: 'var(--space-3)' }}
                                        autoFocus
                                    />

                                    {/* Paleta de colores */}
                                    <div style={{
                                        display: 'flex',
                                        gap: 'var(--space-2)',
                                        flexWrap: 'wrap',
                                        alignItems: 'center',
                                    }}>
                                        {TAG_COLORS.map(color => (
                                            <button
                                                key={color.value}
                                                onClick={() => setNewTagColor(color.value)}
                                                title={color.name}
                                                style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: 'var(--radius-full)',
                                                    backgroundColor: color.value,
                                                    border: newTagColor === color.value
                                                        ? '3px solid var(--color-gray-900)'
                                                        : '2px solid transparent',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {newTagColor === color.value && (
                                                    <Check size={12} style={{ color: '#fff' }} />
                                                )}
                                            </button>
                                        ))}
                                        {/* Color personalizado */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                                            <span style={{ fontSize: '11px', color: 'var(--color-gray-500)' }}>
                                                Personalizado:
                                            </span>
                                            <input
                                                type="color"
                                                value={newTagColor}
                                                onChange={(e) => setNewTagColor(e.target.value)}
                                                style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    padding: 0,
                                                    border: 'none',
                                                    borderRadius: 'var(--radius-full)',
                                                    cursor: 'pointer',
                                                    overflow: 'hidden',
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Preview */}
                                    {newTagName.trim() && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>
                                                Vista previa:
                                            </span>
                                            <span
                                                className="tag"
                                                style={{ backgroundColor: newTagColor, color: '#fff' }}
                                            >
                                                {newTagName.trim()}
                                            </span>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                                        <button
                                            className="btn"
                                            onClick={() => { setIsCreating(false); setNewTagName(''); }}
                                            style={{
                                                backgroundColor: 'var(--color-gray-200)',
                                                color: 'var(--color-gray-700)',
                                            }}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleCreateTag}
                                            disabled={!newTagName.trim()}
                                        >
                                            <Plus size={14} />
                                            Crear
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    className="btn"
                                    onClick={() => setIsCreating(true)}
                                    style={{
                                        width: '100%',
                                        backgroundColor: 'var(--color-gray-100)',
                                        color: 'var(--color-gray-700)',
                                        border: '1.5px dashed var(--color-gray-300)',
                                    }}
                                >
                                    <Plus className="w-4 h-4" />
                                    Nueva etiqueta
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── FOOTER (fijo) ── */}
                <div style={{
                    flexShrink: 0,
                    padding: 'var(--space-3) var(--space-4)',
                    borderTop: '1px solid var(--color-gray-200)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                }}>
                    <button
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-primary)',
                            fontSize: 'var(--font-size-sm)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            padding: 'var(--space-2) var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            transition: 'all var(--transition-fast)',
                            fontWeight: 600,
                            alignSelf: 'flex-start',
                        }}
                        onClick={handleMarkUnread}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(18,140,126,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <EyeOff className="w-4 h-4" />
                        Marcar como no leído
                    </button>

                    <button
                        className="btn btn-primary"
                        onClick={onClose}
                        style={{
                            width: '100%',
                            fontWeight: 600,
                            padding: '10px',
                        }}
                    >
                        Listo
                    </button>
                </div>
            </div>
        </div>
    );
};

/** Helper: encabezado de sección */
const SectionLabel = ({ children }) => (
    <h4 style={{
        fontSize: 'var(--font-size-sm)',
        fontWeight: 600,
        color: 'var(--color-gray-700)',
        margin: 0,
    }}>
        {children}
    </h4>
);

export default TagManager;
