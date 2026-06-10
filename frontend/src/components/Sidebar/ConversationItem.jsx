import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, Bot, UserCheck, Tag, MoreVertical, Edit2, Trash2, Pin, CheckSquare, MessageCircle, Instagram } from 'lucide-react';
import EditContactModal from './EditContactModal';
import { getShortDate } from '../../utils/dateUtils';
import apiFetch from '../../utils/api';

const TikTokIcon = ({ className, style }) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className={className} 
        style={style}
    >
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.74-3.94-1.78-.22-.22-.41-.47-.58-.73v7.02c.01 2.1-.77 4.16-2.22 5.61-1.45 1.47-3.53 2.29-5.63 2.3-2.1.02-4.19-.78-5.65-2.23-1.48-1.46-2.29-3.54-2.29-5.64 0-2.11.81-4.19 2.29-5.65 1.44-1.44 3.52-2.25 5.6-2.24 1.2.01 2.39.31 3.43.89v4.22c-.89-.58-1.97-.87-3.04-.81-1.16.05-2.29.58-3.06 1.45-.77.87-1.15 2.06-1.07 3.22.08 1.17.65 2.26 1.55 3 .9.73 2.08 1.08 3.24 1 .94-.07 1.83-.51 2.44-1.22.56-.66.86-1.52.84-2.39V0h.03z"/>
    </svg>
);

/**
 * Conversation item component
 */
const ConversationItem = React.memo(({
    conversation,
    isSelected,
    aiEnabled,
    tags = [],
    onClick,
    onTagClick,
    onDelete,
    onTogglePin,
    // Multi-selection
    isMultiSelected = false,
    isSelectionMode = false,
    onToggleSelection,
    onEnterSelectionMode
}) => {
    const { contact, lastMessage, timestamp, rawTimestamp, unread, isPinned } = conversation;
    const hasUnread = unread > 0;
    const shortDate = getShortDate(rawTimestamp);

    // Helper para la URL de la sede
    const tenantStr = localStorage.getItem('current_tenant');
    let tenantSlug = null;
    try {
        if (tenantStr) tenantSlug = JSON.parse(tenantStr)?.slug;
    } catch (e) { }

    // Helper para la URL base (usado para fetch y para la imagen)
    let baseApiUrl = typeof process !== 'undefined' && process.env?.REACT_APP_API_URL
        ? process.env.REACT_APP_API_URL
        : window.location.hostname !== 'localhost'
            ? 'https://largebotinterfaz-production-5b38.up.railway.app'
            : 'http://localhost:4000';
    if (baseApiUrl.endsWith('/')) baseApiUrl = baseApiUrl.slice(0, -1);
    const apiPrefix = baseApiUrl.includes('/api') ? '' : '/api';

    // Añadimos el query param 'sede' para que el <img> pueda cargarla sin headers
    const avatarUrl = `${baseApiUrl}${apiPrefix}/conversations/${contact.phone}/avatar${tenantSlug ? `?sede=${tenantSlug}` : ''}`;

    // State for name editing
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    
    // Helper para formatear LIDs largos (IDs internos de WA)
    const formatDisplayName = (name, phone) => {
        let nameToDisplay = name || phone;
        
        // Si el nombre contiene @lid o es una cadena numérica muy larga sin +, es un LID
        const isJid = typeof nameToDisplay === 'string' && (
            nameToDisplay.includes('@') || 
            nameToDisplay.includes('-')
        );

        if (isJid || nameToDisplay.toLowerCase() === 'unknown' || nameToDisplay.toLowerCase().startsWith('usuario')) {
            nameToDisplay = phone;
        }

        // Si después de todo, el texto a mostrar sigue siendo un ID interno (LID), mostrar un alias
        if (typeof nameToDisplay === 'string') {
            const digits = nameToDisplay.replace(/\D/g, '');
            // Si tiene más de 12 dígitos y no empieza con + (o es igual al teléfono), es probablemente un LID
            if (digits.length > 12 && (!nameToDisplay.startsWith('+') || nameToDisplay === phone)) {
                nameToDisplay = `Usuario ${digits.slice(-4)}`;
            }
        }
        
        return nameToDisplay;
    };

    const [displayName, setDisplayName] = useState(() => formatDisplayName(contact.name, contact.phone));
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    // Sync state with props
    useEffect(() => {
        setDisplayName(formatDisplayName(contact.name, contact.phone));
    }, [contact.name, contact.phone]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                menuRef.current && !menuRef.current.contains(event.target) &&
                buttonRef.current && !buttonRef.current.contains(event.target)
            ) {
                setIsMenuOpen(false);
            }
        };
        const handleScroll = () => {
            if (isMenuOpen) setIsMenuOpen(false);
        };
        
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            // Use capture phase (true) to detect scroll in any container
            window.addEventListener('scroll', handleScroll, true); 
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isMenuOpen]);

    const handleSaveName = async (newName) => {
        try {
            const res = await apiFetch('/api/conversations/update-contact-name', {
                method: 'PUT',
                body: JSON.stringify({
                    phone: contact.phone,
                    name: newName
                })
            });

            if (res.ok) {
                setDisplayName(newName);
                return true;
            } else {
                console.error("Failed to update name");
                throw new Error("Failed to update name");
            }
        } catch (error) {
            console.error("Error updating name:", error);
            throw error;
        }
    };

    const handleDeleteConversation = async () => {
        setIsDeleting(true);
        try {
            const res = await apiFetch(`/api/conversations/${encodeURIComponent(contact.phone)}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                if (onDelete) onDelete(contact.phone);
            } else {
                const data = await res.json().catch(() => ({}));
                alert('Error al borrar: ' + (data.message || res.status));
            }
        } catch (err) {
            alert('Error de conexión al borrar la conversación');
            console.error(err);
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    return (
        <div
            className={`conversation-item ${isSelected ? 'active' : ''} ${hasUnread ? 'unread' : ''} ${isMultiSelected ? 'multi-selected' : ''}`}
            onClick={onClick}
            style={{ position: 'relative' }}
        >
            {/* Selection Checkbox — independent click zone */}
            {(isSelectionMode || isMultiSelected) && (
                <div
                    className="selection-checkbox-container"
                    title={isMultiSelected ? 'Quitar de selección' : 'Agregar a selección'}
                    onClick={(e) => {
                        e.stopPropagation(); // prevent opening the conversation
                        onToggleSelection(conversation.id);
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '40px',
                        minWidth: '40px',
                        alignSelf: 'stretch',
                        cursor: 'pointer',
                        zIndex: 2,
                        borderRight: '1px solid var(--color-gray-100)',
                        backgroundColor: isMultiSelected
                            ? 'rgba(18, 140, 126, 0.06)'
                            : 'transparent',
                        transition: 'background-color 0.15s',
                        marginLeft: '-12px', // compensate item padding
                        paddingLeft: '12px',
                        marginRight: '8px',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = isMultiSelected ? 'rgba(18, 140, 126, 0.12)' : 'rgba(0,0,0,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = isMultiSelected ? 'rgba(18, 140, 126, 0.06)' : 'transparent'}
                >
                    <div className={`selection-checkbox ${isMultiSelected ? 'checked' : ''}`}
                        style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            border: isMultiSelected
                                ? '2px solid var(--color-primary)'
                                : '2px solid var(--color-gray-400)',
                            backgroundColor: isMultiSelected ? 'var(--color-primary)' : 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s',
                            flexShrink: 0,
                            boxShadow: isMultiSelected ? '0 0 0 3px rgba(18,140,126,0.15)' : 'none',
                        }}
                    >
                        {isMultiSelected && (
                            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        )}
                    </div>
                </div>
            )}

            <div style={{ position: 'relative' }}>
                <div className="conversation-avatar" style={{ padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' }}>
                    <img
                        src={avatarUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                        }}
                        loading="lazy"
                    />
                    <User className="w-6 h-6 text-gray-400" style={{ display: 'none', color: '#9ca3af' }} />
                </div>
                {/* Channel Indicator Badge */}
                {(() => {
                    const channel = conversation.channel || 'whatsapp_evolution';
                    let icon = null;
                    let bgColor = '#6b7280';
                    let title = '';

                    if (channel === 'whatsapp_evolution') {
                        icon = <MessageCircle size={10} style={{ color: 'white' }} />;
                        bgColor = '#25d366';
                        title = 'WhatsApp (Evolution)';
                    } else if (channel === 'whatsapp_official') {
                        icon = <MessageCircle size={10} style={{ color: 'white' }} />;
                        bgColor = '#0084ff';
                        title = 'WhatsApp Oficial';
                    } else if (channel === 'instagram') {
                        icon = <Instagram size={10} style={{ color: 'white' }} />;
                        bgColor = '#e1306c';
                        title = 'Instagram';
                    } else if (channel === 'tiktok') {
                        icon = <TikTokIcon size={10} style={{ color: 'white' }} />;
                        bgColor = '#0f1419';
                        title = 'TikTok';
                    }

                    return (
                        <div 
                            title={title}
                            style={{
                                position: 'absolute',
                                bottom: '-2px',
                                right: '-2px',
                                width: '18px',
                                height: '18px',
                                backgroundColor: bgColor,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid white',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                zIndex: 1
                            }}
                        >
                            {icon}
                        </div>
                    );
                })()}
                {hasUnread && (
                    <div style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        width: '12px',
                        height: '12px',
                        backgroundColor: 'var(--color-primary-light)',
                        borderRadius: '50%',
                        border: '2px solid var(--color-white)',
                        zIndex: 1
                    }} />
                )}
            </div>

            <div className="conversation-content">
                <div className="conversation-header">
                    {/* Name */}
                    <span className="conversation-name" style={{
                        fontWeight: hasUnread ? 700 : 600,
                        color: hasUnread ? 'var(--color-gray-900)' : undefined,
                        maxWidth: '60%'
                    }}>
                        {displayName}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <button
                            className="btn-icon"
                            onClick={(e) => onTagClick && onTagClick(conversation, e)}
                            title="Etiquetar"
                            style={{
                                padding: '2px',
                                color: 'var(--color-gray-500)',
                                opacity: 0.7
                            }}
                        >
                            <Tag className="w-3 h-3" />
                        </button>

                        {/* More Options Menu */}
                        <div style={{ position: 'relative', display: 'flex' }}>
                            <button
                                ref={buttonRef}
                                className="btn-icon"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isMenuOpen) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        // Calculate position to keep it within viewport
                                        const menuHeight = 120;
                                        const menuWidth = 180;
                                        const spaceBelow = window.innerHeight - rect.bottom;
                                        
                                        let top = rect.bottom + 5;
                                        if (spaceBelow < menuHeight) {
                                            top = rect.top - menuHeight - 5;
                                        }

                                        setMenuPosition({
                                            top: top,
                                            left: Math.max(10, rect.right - menuWidth)
                                        });
                                    }
                                    setIsMenuOpen(!isMenuOpen);
                                }}
                                title="Opciones"
                                style={{
                                    padding: '4px',
                                    color: isMenuOpen ? 'var(--color-primary)' : 'var(--color-gray-500)',
                                    backgroundColor: isMenuOpen ? 'var(--color-gray-100)' : 'transparent',
                                    borderRadius: '50%',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <MoreVertical className="w-4 h-4" />
                            </button>

                            {isMenuOpen && createPortal(
                                <div 
                                    ref={menuRef}
                                    className="glass-morphism"
                                    style={{
                                        position: 'fixed',
                                        top: menuPosition.top,
                                        left: menuPosition.left,
                                        zIndex: 999999,
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        border: '1px solid var(--color-gray-200)',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                                        minWidth: '180px',
                                        padding: '6px',
                                        animation: 'fadeIn 0.15s ease-out',
                                        pointerEvents: 'auto'
                                    }} 
                                    onClick={e => e.stopPropagation()}
                                >
                                    <div style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--color-gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Opciones
                                    </div>
                                    
                                    <button
                                        onClick={() => {
                                            setIsEditModalOpen(true);
                                            setIsMenuOpen(false);
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            width: '100%',
                                            padding: '10px 12px',
                                            border: 'none',
                                            background: 'none',
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            color: 'var(--color-gray-700)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            borderRadius: '8px',
                                            transition: 'background 0.2s'
                                        }}
                                        className="hover:bg-gray-50"
                                    >
                                        <Edit2 size={14} className="text-gray-400" />
                                        <span>Editar nombre</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (onEnterSelectionMode) onEnterSelectionMode(conversation.id);
                                            setIsMenuOpen(false);
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            width: '100%',
                                            padding: '10px 12px',
                                            border: 'none',
                                            background: 'none',
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            color: 'var(--color-gray-700)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            borderRadius: '8px',
                                            transition: 'background 0.2s'
                                        }}
                                        className="hover:bg-gray-50"
                                    >
                                        <CheckSquare size={14} className="text-gray-400" />
                                        <span>Seleccionar</span>
                                    </button>

                                    {/* Separator */}
                                    <div style={{ height: '1px', backgroundColor: 'var(--color-gray-100)', margin: '4px 8px' }} />

                                    {/* Delete conversation */}
                                    {!showDeleteConfirm ? (
                                        <button
                                            onClick={() => {
                                                setShowDeleteConfirm(true);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                width: '100%',
                                                padding: '10px 12px',
                                                border: 'none',
                                                background: 'none',
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                borderRadius: '8px',
                                                transition: 'background 0.2s'
                                            }}
                                            className="hover:bg-red-50"
                                        >
                                            <Trash2 size={14} />
                                            <span>Borrar chat</span>
                                        </button>
                                    ) : (
                                        <div style={{ padding: '10px 12px', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', margin: '2px' }}>
                                            <p style={{ fontSize: '11px', color: '#b91c1c', margin: '0 0 10px', fontWeight: 600 }}>
                                                ¿Confirmas borrar todo?
                                            </p>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={handleDeleteConversation}
                                                    disabled={isDeleting}
                                                    style={{
                                                        flex: 1, padding: '6px 0',
                                                        backgroundColor: '#ef4444', color: 'white',
                                                        border: 'none', borderRadius: '6px',
                                                        fontSize: '11px', fontWeight: 700,
                                                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                                                        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)'
                                                    }}
                                                >
                                                    {isDeleting ? '...' : 'Sí'}
                                                </button>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(false)}
                                                    style={{
                                                        flex: 1, padding: '6px 0',
                                                        backgroundColor: 'white', color: '#4b5563',
                                                        border: '1px solid var(--color-gray-200)', borderRadius: '6px',
                                                        fontSize: '11px', fontWeight: 600, cursor: 'pointer'
                                                    }}
                                                >
                                                    No
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>,
                                document.body
                            )}
                        </div>

                        <div className={`status-indicator ${aiEnabled ? 'status-ai' : 'status-manual'}`}
                            style={{ padding: '2px 6px', fontSize: '10px' }}>
                            {aiEnabled ? (
                                <>
                                    <Bot className="w-3 h-3" />
                                    <span>IA</span>
                                </>
                            ) : (
                                <>
                                    <UserCheck className="w-3 h-3" />
                                    <span>Manual</span>
                                </>
                            )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '50px' }}>
                            <span className="conversation-time" style={{
                                color: hasUnread ? 'var(--color-primary)' : undefined,
                                fontWeight: hasUnread ? 600 : undefined,
                                lineHeight: '1.2'
                            }}>
                                {timestamp}
                            </span>
                            {shortDate && (
                                <span style={{
                                    fontSize: '9px',
                                    color: hasUnread ? 'var(--color-primary)' : 'var(--color-gray-500)',
                                    fontWeight: hasUnread ? 600 : 500,
                                    marginTop: '2px',
                                    lineHeight: '1.2',
                                    paddingBottom: '2px'
                                }}>
                                    {shortDate}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <p className="conversation-preview" style={{
                    fontWeight: hasUnread ? 500 : 400,
                    color: hasUnread ? 'var(--color-gray-800)' : undefined
                }}>
                    {lastMessage || 'No hay mensajes'}
                </p>

                <div className="conversation-footer">
                    <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-gray-400)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                    }}>
                        {(typeof contact.phone === 'string' && contact.phone.replace(/\D/g, '').length > 13 && !contact.phone.startsWith('+')) 
                            ? `ID Interno (${contact.phone.slice(-4)})` 
                            : contact.phone}
                    </span>

                    {tags.length > 0 && (
                        <div className="tags-container" style={{ marginLeft: 'var(--space-2)', flexShrink: 0 }}>
                            {tags.slice(0, 2).map(tag => (
                                <span
                                    key={tag.id}
                                    className="tag tag-small"
                                    style={{ backgroundColor: tag.color, color: '#fff' }}
                                >
                                    {tag.name}
                                </span>
                            ))}
                            {tags.length > 2 && (
                                <span className="tag tag-small" style={{ backgroundColor: 'var(--color-gray-400)', color: '#fff' }}>
                                    +{tags.length - 2}
                                </span>
                            )}
                        </div>
                    )}

                    {hasUnread && (
                        <span className="unread-badge" style={{
                            minWidth: '22px',
                            height: '22px',
                            fontSize: '12px',
                            fontWeight: 700,
                            animation: 'pulse 2s infinite'
                        }}>
                            {unread}
                        </span>
                    )}

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onTogglePin) onTogglePin(contact.phone);
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            padding: '4px',
                            marginLeft: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isPinned ? 'var(--color-gray-900)' : 'var(--color-gray-400)',
                            opacity: isPinned ? 1 : 0.6
                        }}
                        title={isPinned ? 'Desanclar' : 'Anclar'}
                    >
                        <Pin
                            size={14}
                            style={{
                                fill: isPinned ? 'currentColor' : 'none',
                                transform: 'rotate(45deg)'
                            }}
                        />
                    </button>
                </div>
            </div>

            {/* Edit Contact Modal */}
            {
                isEditModalOpen && (
                    <EditContactModal
                        isOpen={isEditModalOpen}
                        onClose={() => setIsEditModalOpen(false)}
                        initialName={displayName}
                        onSave={handleSaveName}
                        contactPhone={contact.phone}
                    />
                )
            }
        </div >
    );
});

export default ConversationItem;

