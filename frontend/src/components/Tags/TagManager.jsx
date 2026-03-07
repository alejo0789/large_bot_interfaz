import React, { useState, useRef, useEffect } from 'react';
import { X, Tag, Search, Check, EyeOff } from 'lucide-react';
import TagBadge from './TagBadge';

/**
 * Tag picker modal — focused on assigning/removing tags quickly.
 * Creating tags is done from the filter menu, not here.
 */
const TagManager = ({
    isOpen,
    onClose,
    tags,
    conversationPhone,
    conversationTags = [],
    onCreateTag,   // kept for API compat, not used in UI
    onAssignTag,
    onRemoveTag,
    onMarkUnread,
    onUpdateTag,   // kept for API compat
    isBulk = false,
    bulkPhones = []
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [pendingId, setPendingId] = useState(null);  // tagId being processed
    // ── Optimistic local state ─────────────────────────────────────────────────
    // Mirror the assigned IDs locally so UI updates instantly without waiting
    // for the parent component to re-render after the API call.
    const [localAssignedIds, setLocalAssignedIds] = useState(() => new Set(conversationTags.map(t => t.id)));
    const searchRef = useRef(null);

    // Sync with parent whenever modal opens (reset to current server truth)
    useEffect(() => {
        if (isOpen) {
            setLocalAssignedIds(new Set(conversationTags.map(t => t.id)));
            setSearchQuery('');
            setTimeout(() => searchRef.current?.focus(), 80);
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps


    if (!isOpen) return null;

    // Build full tag objects for assigned (from localAssignedIds for instant feedback)
    const tagsById = new Map(tags.map(t => [t.id, t]));
    const allSorted = [...tags].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
        ? allSorted.filter(t => t.name.toLowerCase().includes(query))
        : allSorted;

    const assignedFiltered = filtered.filter(t => localAssignedIds.has(t.id));
    const availableFiltered = filtered.filter(t => !localAssignedIds.has(t.id));


    const handleToggle = async (tag) => {
        if (localAssignedIds.has(tag.id)) {
            // ── Optimistic remove ──
            setLocalAssignedIds(prev => { const s = new Set(prev); s.delete(tag.id); return s; });
            setPendingId(tag.id);
            try {
                if (isBulk && bulkPhones.length > 0) {
                    for (const phone of bulkPhones) await onRemoveTag(phone, tag.id);
                } else {
                    await onRemoveTag(conversationPhone, tag.id);
                }
            } catch (e) {
                console.error(e);
                // Revert on error
                setLocalAssignedIds(prev => new Set([...prev, tag.id]));
            } finally {
                setPendingId(null);
            }
        } else {
            // ── Optimistic assign ──
            setLocalAssignedIds(prev => new Set([...prev, tag.id]));
            setPendingId(tag.id);
            try {
                if (isBulk && bulkPhones.length > 0) {
                    for (const phone of bulkPhones) await onAssignTag(phone, tag.id);
                } else {
                    await onAssignTag(conversationPhone, tag.id);
                }
            } catch (e) {
                console.error(e);
                // Revert on error
                setLocalAssignedIds(prev => { const s = new Set(prev); s.delete(tag.id); return s; });
            } finally {
                setPendingId(null);
            }
        }
    };


    const handleMarkUnread = async () => {
        if (onMarkUnread) {
            if (isBulk && bulkPhones.length > 0) {
                for (const phone of bulkPhones) await onMarkUnread(phone);
            } else {
                await onMarkUnread(conversationPhone);
            }
            onClose();
        }
    };

    const title = isBulk
        ? `Etiquetar ${bulkPhones.length} chat${bulkPhones.length !== 1 ? 's' : ''}`
        : 'Etiquetar conversación';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
                    width: '100%',
                    maxWidth: '380px',
                    maxHeight: '82vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slideUp 0.2s cubic-bezier(0.16,1,0.3,1)',
                }}
            >
                {/* ── HEADER ── */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 16px 12px',
                    borderBottom: '1px solid #f1f5f9',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '32px', height: '32px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #128C7E 0%, #075E54 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Tag size={16} color="white" />
                        </div>
                        <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#111827' }}>
                                {title}
                            </p>
                            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                                {localAssignedIds.size === 0
                                    ? 'Sin etiquetas asignadas'
                                    : `${localAssignedIds.size} asignada${localAssignedIds.size !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#f3f4f6', border: 'none', borderRadius: '8px',
                            width: '32px', height: '32px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#6b7280', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#111827'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#6b7280'; }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* ── SEARCH ── */}
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{
                            position: 'absolute', left: '10px', top: '50%',
                            transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none',
                        }} />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Buscar etiqueta…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '8px 10px 8px 30px',
                                borderRadius: '10px', border: '1.5px solid #e5e7eb',
                                fontSize: '13px', outline: 'none',
                                backgroundColor: '#f9fafb', boxSizing: 'border-box',
                                transition: 'border-color 0.15s, box-shadow 0.15s',
                            }}
                            onFocus={e => {
                                e.target.style.borderColor = '#128C7E';
                                e.target.style.boxShadow = '0 0 0 3px rgba(18,140,126,0.1)';
                            }}
                            onBlur={e => {
                                e.target.style.borderColor = '#e5e7eb';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>
                </div>

                {/* ── TAG LIST ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>

                    {/* Asignadas */}
                    {assignedFiltered.length > 0 && (
                        <div>
                            <p style={{
                                margin: '4px 0 4px',
                                padding: '0 14px',
                                fontSize: '10px',
                                fontWeight: 700,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                color: '#9ca3af',
                            }}>
                                Asignadas
                            </p>
                            {assignedFiltered.map(tag => (
                                <TagRow
                                    key={tag.id}
                                    tag={tag}
                                    assigned
                                    loading={pendingId === tag.id}
                                    onClick={() => handleToggle(tag)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Disponibles */}
                    {availableFiltered.length > 0 && (
                        <div style={{ marginTop: assignedFiltered.length > 0 ? '8px' : 0 }}>
                            {(assignedFiltered.length > 0 || query) && (
                                <p style={{
                                    margin: '4px 0 4px',
                                    padding: '0 14px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    color: '#9ca3af',
                                }}>
                                    Disponibles
                                </p>
                            )}
                            {availableFiltered.map(tag => (
                                <TagRow
                                    key={tag.id}
                                    tag={tag}
                                    assigned={false}
                                    loading={pendingId === tag.id}
                                    onClick={() => handleToggle(tag)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Sin resultados */}
                    {filtered.length === 0 && (
                        <div style={{
                            padding: '32px 16px',
                            textAlign: 'center',
                            color: '#9ca3af',
                        }}>
                            <Tag size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
                            <p style={{ margin: 0, fontSize: '13px' }}>
                                {query ? `Sin resultados para "${searchQuery}"` : 'No hay etiquetas creadas'}
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '11px' }}>
                                Crea etiquetas desde el menú de filtros
                            </p>
                        </div>
                    )}

                    {/* Sin etiquetas en sistema */}
                    {tags.length === 0 && (
                        <div style={{
                            padding: '32px 16px',
                            textAlign: 'center',
                            color: '#9ca3af',
                        }}>
                            <Tag size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
                                Sin etiquetas disponibles
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '11px' }}>
                                Ve a Filtros → Etiquetas para crear la primera
                            </p>
                        </div>
                    )}
                </div>

                {/* ── FOOTER ── */}
                <div style={{
                    borderTop: '1px solid #f1f5f9',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                }}>
                    <button
                        onClick={handleMarkUnread}
                        style={{
                            background: 'none', border: 'none',
                            color: '#6b7280', fontSize: '12px',
                            cursor: 'pointer', display: 'flex',
                            alignItems: 'center', gap: '5px',
                            padding: '6px 8px', borderRadius: '8px',
                            transition: 'all 0.15s', whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#374151'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280'; }}
                        title="Marcar conversación como no leída"
                    >
                        <EyeOff size={13} />
                        No leído
                    </button>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'linear-gradient(135deg, #128C7E 0%, #075E54 100%)',
                            color: 'white', border: 'none',
                            borderRadius: '10px', padding: '8px 20px',
                            fontSize: '13px', fontWeight: 600,
                            cursor: 'pointer', transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        Listo
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Single tag row inside the picker list
 */
const TagRow = ({ tag, assigned, loading, onClick }) => (
    <button
        onClick={onClick}
        disabled={loading}
        style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 14px',
            border: 'none',
            background: assigned ? 'rgba(18,140,126,0.05)' : 'none',
            cursor: loading ? 'wait' : 'pointer',
            textAlign: 'left',
            fontSize: '13px',
            color: '#111827',
            transition: 'background 0.1s',
            opacity: loading ? 0.6 : 1,
        }}
        onMouseEnter={e => {
            if (!loading) e.currentTarget.style.backgroundColor = assigned
                ? 'rgba(18,140,126,0.1)'
                : '#f9fafb';
        }}
        onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = assigned
                ? 'rgba(18,140,126,0.05)'
                : 'transparent';
        }}
    >
        {/* Color dot */}
        <span style={{
            width: '12px', height: '12px',
            borderRadius: '50%',
            backgroundColor: tag.color || '#6b7280',
            flexShrink: 0,
            boxShadow: `0 0 0 2px ${(tag.color || '#6b7280')}33`,
        }} />

        {/* Name */}
        <span style={{ flex: 1, fontWeight: assigned ? 600 : 400 }}>
            {tag.name}
        </span>

        {/* Check / loading */}
        {loading ? (
            <span style={{
                width: '16px', height: '16px',
                border: '2px solid #d1d5db',
                borderTopColor: tag.color || '#128C7E',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
                flexShrink: 0,
                display: 'inline-block',
            }} />
        ) : assigned ? (
            <span style={{
                width: '20px', height: '20px',
                borderRadius: '6px',
                background: tag.color || '#128C7E',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
            }}>
                <Check size={12} color="white" strokeWidth={3} />
            </span>
        ) : (
            <span style={{
                width: '20px', height: '20px',
                borderRadius: '6px',
                border: '1.5px solid #e5e7eb',
                flexShrink: 0,
            }} />
        )}
    </button>
);

export default TagManager;
