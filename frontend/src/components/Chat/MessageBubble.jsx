import React, { useState, useEffect, useRef } from 'react';
import { CheckCheck, Clock, Download, FileText, Image as ImageIcon, Mic, Forward, Trash2, Smile, MoreHorizontal, ChevronDown } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

/**
 * Message bubble component with media support, reactions, and actions
 */
const MessageBubble = ({ message, onForward, onReact, onDelete }) => {
    const { text, timestamp, status, id, reactions = [] } = message;
    const rawSender = message.sender || message.sender_type || 'customer';
    const sender = String(rawSender).toLowerCase().trim();

    const media_type = message.media_type || message.mediaType;
    let media_url = message.media_url || message.mediaUrl;

    // Fix localhost URLs for mobile/remote access
    if (media_url && typeof media_url === 'string' && media_url.includes('localhost') && window.location.hostname !== 'localhost') {
        media_url = media_url.replace('localhost', window.location.hostname);
    }

    const [imageError, setImageError] = useState(false);
    const [showFullImage, setShowFullImage] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const menuRef = useRef(null);

    // Identify if message is outgoing (from the business/bot)
    // Be broad to catch variations in naming (agent, bot, system, me, ai, etc.)
    const isBot = sender.includes('bot') || sender.includes('ai');
    const isAgent = sender.includes('agent') || sender.includes('agente') || sender === 'me' || sender === 'yo';
    const isSystem = sender.includes('system') || sender.includes('sistema') || sender.includes('admin');

    const isOutgoing = isAgent || isBot || isSystem;

    const getMessageClass = () => {
        let classes = ['message'];
        if (isOutgoing) classes.push('outgoing');
        else classes.push('incoming');

        if (isAgent) classes.push('agent');
        if (isBot) classes.push('bot');
        if (isSystem) classes.push('system');

        // Add deleted class if status is deleted or text matches placeholder
        if (status === 'deleted' || text === '🚫 Mensaje eliminado') {
            classes.push('deleted');
        }

        return classes.join(' ');
    };

    // New: Check if message is deleted
    const isDeleted = status === 'deleted' || text === '🚫 Mensaje eliminado';



    const getStatusIcon = () => {
        if (!isOutgoing) return null;

        switch (status) {
            case 'sending':
                return <Clock className="w-3 h-3" style={{ opacity: 0.7 }} />;
            case 'delivered':
                return <CheckCheck className="w-3 h-3" style={{ opacity: 0.7 }} />;
            case 'read':
                return <CheckCheck className="w-3 h-3" style={{ color: '#34B7F1' }} />;
            case 'failed':
                return <span style={{ color: '#EF4444', fontSize: '12px' }}>❌</span>;
            default:
                return <CheckCheck className="w-3 h-3" style={{ opacity: 0.7 }} />;
        }
    };

    // Handle Context Menu (Right Click / Long Press)
    const handleContextMenu = (e) => {
        e.preventDefault();
        // Calculate position - prefer centered above/below but keep in viewport
        const x = e.clientX;
        const y = e.clientY;
        setMenuPosition({ x, y });
        setShowMenu(true);
    };

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside); // For mobile
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [showMenu]);

    const handleReactionClick = (emoji) => {
        if (onReact) onReact(message, emoji);
        setShowMenu(false);
    };

    const handleDeleteClick = () => {
        if (onDelete) onDelete(message);
        setShowMenu(false);
    };

    // Render media content based on type
    const renderMedia = () => {
        if (!media_url) return null;

        switch (media_type) {
            case 'image':
                return (
                    <div
                        style={{
                            cursor: 'pointer',
                            marginBottom: text ? 'var(--space-2)' : 0
                        }}
                        onClick={() => setShowFullImage(true)}
                    >
                        {!imageError ? (
                            <img
                                src={media_url}
                                alt="Imagen"
                                onError={() => setImageError(true)}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '300px',
                                    borderRadius: 'var(--radius-md)',
                                    objectFit: 'cover'
                                }}
                            />
                        ) : (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                                padding: 'var(--space-3)',
                                backgroundColor: 'rgba(0,0,0,0.1)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <ImageIcon className="w-5 h-5" />
                                <span>Imagen no disponible</span>
                            </div>
                        )}
                    </div>
                );

            case 'video':
                return (
                    <div style={{ marginBottom: text ? 'var(--space-2)' : 0 }}>
                        <video
                            controls
                            style={{
                                maxWidth: '100%',
                                maxHeight: '300px',
                                borderRadius: 'var(--radius-md)'
                            }}
                        >
                            <source src={media_url} />
                            Tu navegador no soporta video.
                        </video>
                    </div>
                );

            case 'audio':
                return (
                    <div style={{
                        marginBottom: text ? 'var(--space-2)' : 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        backgroundColor: 'rgba(0,0,0,0.05)',
                        padding: 'var(--space-2)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <Mic className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                        <audio controls style={{ flex: 1, height: '36px' }}>
                            <source src={media_url} />
                        </audio>
                    </div>
                );

            case 'document':
            default:
                if (media_url) {
                    const fileName = media_url.split('/').pop() || 'file';
                    return (
                        <a
                            href={media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                                padding: 'var(--space-2) var(--space-3)',
                                backgroundColor: 'rgba(0,0,0,0.05)',
                                borderRadius: 'var(--radius-md)',
                                textDecoration: 'none',
                                color: 'inherit',
                                marginBottom: text ? 'var(--space-2)' : 0
                            }}
                        >
                            <FileText className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                            <span style={{
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: 'var(--font-size-sm)'
                            }}>
                                {fileName}
                            </span>
                            <Download className="w-4 h-4" style={{ opacity: 0.6 }} />
                        </a>
                    );
                }
                return null;
        }
    };

    // Updated formatter to handle bold and newlines explicitly
    const formatText = (content) => {
        if (!content) return content;

        // Convert to string just in case
        const textStr = String(content);

        // Handle bold: **text**
        const boldParts = textStr.split(/(\*\*.*?\*\*)/g);

        return boldParts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={`b-${i}`}>{part.slice(2, -2)}</strong>;
            }

            // For non-bold parts, handle newlines
            const lineParts = part.split('\n');
            return lineParts.map((line, j) => (
                <React.Fragment key={`l-${i}-${j}`}>
                    {line}
                    {j < lineParts.length - 1 && <br />}
                </React.Fragment>
            ));
        });
    };

    const handleMenuButton = (e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuPosition({
            x: rect.left,
            y: rect.bottom + 5
        });
        setShowMenu(true);
    };

    if (isDeleted) {
        return (
            <div className={getMessageClass()} style={{ userSelect: 'none' }}>
                <div className="message-container">
                    <div className="message-bubble" style={{
                        fontStyle: 'italic',
                        color: 'var(--color-gray-500)',
                        backgroundColor: isOutgoing ? '#e0f2fe' : '#f3f4f6', // Lighter bg for deleted
                        border: '1px dashed var(--color-gray-300)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '8px 12px'
                    }}>
                        <span style={{ fontSize: '14px' }}>🚫 Este mensaje fue eliminado</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div
                className={getMessageClass()}
                onContextMenu={handleContextMenu}
                style={{ userSelect: 'none' }} // Prevent text selection on long press for better UX on mobile
            >
                <div className="message-container" style={{ position: 'relative' }}>
                    <div className="message-bubble" style={{
                        padding: media_url ? 'var(--space-1)' : 'var(--space-2) var(--space-3)',
                        paddingLeft: '32px', // Space for the chevron button on the left
                        overflow: 'visible', // Allow reactions to pop out
                        position: 'relative',
                        minWidth: '80px',
                        maxWidth: '100%',
                        overflowWrap: 'anywhere'
                    }}>
                        {/* Menu Chevron - Visible on bubble hover or swipe */}
                        <button
                            onClick={handleMenuButton}
                            className="menu-chevron"
                            style={{
                                position: 'absolute',
                                top: '4px',
                                left: '4px', // Position on left
                                right: 'auto',
                                background: 'rgba(255,255,255,0.8)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                zIndex: 20,
                                padding: 0,
                                opacity: 0, // Hidden by default on desktop until hover
                                transition: 'opacity 0.2s',
                                color: 'var(--color-gray-600)',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                        >
                            <ChevronDown size={14} />
                        </button>
                        <style>{`
                            .message-bubble:hover .menu-chevron {
                                opacity: 1 !important;
                            }
                            @media (hover: none) {
                                .menu-chevron {
                                    opacity: 1 !important; /* Always visible on mobile */
                                    background: rgba(255,255,255,0.9);
                                }
                            }
                        `}</style>
                        {(message.sender_name || message.agent_name) && (
                            <div style={{
                                fontSize: '10px',
                                fontWeight: '700',
                                color: isOutgoing ? 'rgba(255, 255, 255, 0.85)' : 'var(--color-primary)',
                                textAlign: isOutgoing ? 'right' : 'left',
                                marginBottom: '4px',
                                paddingRight: (isOutgoing && media_url) ? '4px' : '0',
                                paddingLeft: (!isOutgoing && media_url) ? '4px' : '0',
                                paddingTop: media_url ? '4px' : '0',
                                overflowWrap: 'anywhere',
                                maxWidth: '100%'
                            }}>
                                {message.sender_name || message.agent_name}
                            </div>
                        )}

                        {renderMedia()}
                        {
                            text && (
                                <p className="message-text" style={{
                                    padding: media_url ? 'var(--space-1) var(--space-2)' : undefined,
                                    fontSize: media_type ? 'var(--font-size-sm)' : undefined,
                                    overflowWrap: 'anywhere',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'pre-wrap',
                                    maxWidth: '100%',
                                    userSelect: 'text' // Allow text selection inside bubble
                                }}>
                                    {formatText(text)}
                                </p>
                            )
                        }

                        <div className="message-meta" style={{
                            padding: media_url ? '0 var(--space-2) var(--space-1)' : undefined
                        }}>
                            <span className="message-time">{timestamp}</span>
                            {isOutgoing && (
                                <span className="message-status">
                                    {getStatusIcon()}
                                </span>
                            )}
                        </div>

                        {/* Reactions Display */}
                        {
                            reactions && reactions.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-12px',
                                    left: '-8px', // Position on the left, slightly outside
                                    right: 'auto', // Reset right
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: '2px 4px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    zIndex: 10, // Increased z-index
                                    border: '1px solid #e5e7eb',
                                    whiteSpace: 'nowrap' // Prevent wrapping
                                }}>
                                    {reactions.map((r, idx) => (
                                        <span key={idx} title={r.by}>{r.emoji}</span>
                                    ))}
                                </div>
                            )
                        }
                    </div >

                    {/* Forward Button */}
                    {
                        onForward && (
                            <button
                                className="forward-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onForward(message);
                                }}
                                title="Reenviar mensaje"
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    right: isOutgoing ? '100%' : 'auto',
                                    left: isOutgoing ? 'auto' : '100%',
                                    marginLeft: isOutgoing ? '0' : '8px',
                                    marginRight: isOutgoing ? '8px' : '0',
                                    background: 'white',
                                    border: '1px solid var(--color-gray-200)',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    color: 'var(--color-gray-500)',
                                    padding: '6px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 10,
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                    pointerEvents: 'none'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = 'var(--color-primary)';
                                    e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = 'var(--color-gray-500)';
                                    e.currentTarget.style.backgroundColor = 'white';
                                }}
                            >
                                <Forward className="w-3 h-3" />
                            </button>
                        )
                    }
                </div >

                {/* CSS to show forward button on hover - Scoped to this message item */}
                < style > {`
                    .message:hover .forward-btn {
                        opacity: 1 !important;
                        pointer-events: auto !important;
                    }
                `}</style >
            </div >

            {/* Context Menu Modal */}
            {
                showMenu && (
                    <div
                        className="modal-overlay"
                        style={{ alignItems: 'flex-start', paddingTop: '0', background: 'rgba(0,0,0,0.1)' }}
                        onClick={() => setShowMenu(false)}
                    >
                        <div
                            ref={menuRef}
                            style={{
                                position: 'absolute',
                                top: Math.min(window.innerHeight - 220, Math.max(10, menuPosition.y)),
                                left: Math.min(window.innerWidth - 300, Math.max(10, menuPosition.x)),
                                background: 'white',
                                borderRadius: '12px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                padding: '8px',
                                zIndex: 3000,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                animation: 'fadeIn 0.2s ease'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Reaction Bar */}
                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                padding: '4px',
                                borderBottom: '1px solid #f3f4f6',
                                marginBottom: '4px'
                            }}>
                                {['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => handleReactionClick(emoji)}
                                        style={{
                                            fontSize: '20px',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            borderRadius: '50%',
                                            transition: 'transform 0.1s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <button
                                    onClick={handleDeleteClick}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'none',
                                        width: '100%',
                                        textAlign: 'left',
                                        fontSize: '14px',
                                        color: '#ef4444',
                                        cursor: 'pointer',
                                        borderRadius: '6px'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Eliminar mensaje
                                </button>

                                <button
                                    onClick={() => {
                                        onForward && onForward(message);
                                        setShowMenu(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'none',
                                        width: '100%',
                                        textAlign: 'left',
                                        fontSize: '14px',
                                        color: '#4b5563',
                                        cursor: 'pointer',
                                        borderRadius: '6px'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                    <Forward className="w-4 h-4" />
                                    Reenviar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Full screen image modal */}
            {
                showFullImage && media_type === 'image' && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0,0,0,0.9)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            cursor: 'pointer'
                        }}
                        onClick={() => setShowFullImage(false)}
                    >
                        <img
                            src={media_url}
                            alt="Imagen completa"
                            style={{
                                maxWidth: '95%',
                                maxHeight: '95%',
                                objectFit: 'contain'
                            }}
                        />
                        <button
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                background: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                cursor: 'pointer',
                                fontSize: '20px'
                            }}
                            onClick={() => setShowFullImage(false)}
                        >
                            ×
                        </button>
                    </div>
                )
            }
        </>
    );
};

export default MessageBubble;

