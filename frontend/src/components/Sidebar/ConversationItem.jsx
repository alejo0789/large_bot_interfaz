import React, { useState, useRef, useEffect } from 'react';
import { User, Bot, UserCheck, Tag, MoreVertical, Edit2 } from 'lucide-react';
import EditContactModal from './EditContactModal';

/**
 * Conversation item component
 */
const ConversationItem = React.memo(({
    conversation,
    isSelected,
    aiEnabled,
    tags = [],
    onClick,
    onTagClick
}) => {
    const { contact, lastMessage, timestamp, unread } = conversation;
    const hasUnread = unread > 0;

    // State for name editing
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [displayName, setDisplayName] = useState(contact.name);
    const menuRef = useRef(null);

    // Sync state with props
    useEffect(() => {
        setDisplayName(contact.name);
    }, [contact.name]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSaveName = async (newName) => {
        try {
            // Robust API URL detection (CRA vs Vite)
            let apiUrl = '/api';

            // Check for CRA (Create React App) environment variables
            if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) {
                apiUrl = process.env.REACT_APP_API_URL;
            }
            // Check for Vite environment variables
            else {
                try {
                    if (import.meta && import.meta.env && import.meta.env.VITE_API_URL) {
                        apiUrl = import.meta.env.VITE_API_URL;
                    }
                } catch (e) {
                    // Ignore, likely not Vite
                }
            }

            // Fallback for local development if env var is missing
            if ((!apiUrl || apiUrl === '/api') && window.location.hostname === 'localhost') {
                console.warn('⚠️ REACT_APP_API_URL not found, falling back to http://localhost:4000');
                apiUrl = 'http://localhost:4000';
            }

            console.log('🔗 Updating Name using API:', apiUrl);

            // Remove trailing slash if present
            if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);

            // Construct full URL using safer endpoint that accepts phone in body
            let finalUrl;
            if (apiUrl.includes('/api')) {
                finalUrl = `${apiUrl}/conversations/update-contact-name`;
            } else {
                finalUrl = `${apiUrl}/api/conversations/update-contact-name`;
            }

            // Fix double slashes just in case
            finalUrl = finalUrl.replace(/([^:]\/)\/+/g, "$1");

            const res = await fetch(finalUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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

    return (
        <div
            className={`conversation-item ${isSelected ? 'active' : ''} ${hasUnread ? 'unread' : ''}`}
            onClick={onClick}
            style={{ position: 'relative' }}
        >
            <div style={{ position: 'relative' }}>
                <div className="conversation-avatar">
                    <User className="w-6 h-6" />
                </div>
                {hasUnread && (
                    <div style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        width: '12px',
                        height: '12px',
                        backgroundColor: 'var(--color-primary-light)',
                        borderRadius: '50%',
                        border: '2px solid var(--color-white)'
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
                        <div style={{ position: 'relative' }} ref={menuRef}>
                            <button
                                className="btn-icon"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMenuOpen(!isMenuOpen);
                                }}
                                title="Opciones"
                                style={{
                                    padding: '2px',
                                    color: 'var(--color-gray-500)',
                                    opacity: 0.7
                                }}
                            >
                                <MoreVertical className="w-3 h-3" />
                            </button>

                            {isMenuOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    zIndex: 100,
                                    backgroundColor: 'white',
                                    border: '1px solid var(--color-gray-200)',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                    minWidth: '120px',
                                    padding: '4px 0'
                                }} onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => {
                                            setIsEditModalOpen(true);
                                            setIsMenuOpen(false);
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: 'none',
                                            background: 'none',
                                            fontSize: '12px',
                                            color: 'var(--color-gray-700)',
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                        }}
                                        className="hover:bg-gray-50"
                                    >
                                        <Edit2 size={12} />
                                        Editar nombre
                                    </button>
                                </div>
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
                        <span className="conversation-time" style={{
                            color: hasUnread ? 'var(--color-primary)' : undefined,
                            fontWeight: hasUnread ? 600 : undefined
                        }}>
                            {timestamp}
                        </span>
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
                        {contact.phone}
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

