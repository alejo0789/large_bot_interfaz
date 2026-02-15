import React, { useState } from 'react';
import { CheckCheck, Clock, Download, FileText, Image as ImageIcon, Mic, Share } from 'lucide-react';

/**
 * Message bubble component with media support
 */
const MessageBubble = ({ message, onForward }) => {
    const { text, timestamp, status } = message;
    const sender = message.sender || message.sender_type;
    const media_type = message.media_type || message.mediaType;
    let media_url = message.media_url || message.mediaUrl;

    // Fix localhost URLs for mobile/remote access
    if (media_url && typeof media_url === 'string' && media_url.includes('localhost') && window.location.hostname !== 'localhost') {
        media_url = media_url.replace('localhost', window.location.hostname);
    }

    const [imageError, setImageError] = useState(false);
    const [showFullImage, setShowFullImage] = useState(false);

    const isOutgoing = sender === 'agent' || sender === 'bot' || sender === 'me' || sender === 'ai';
    const isBot = sender === 'bot' || sender === 'ai';
    const isAgent = sender === 'agent' || sender === 'me';

    const getMessageClass = () => {
        if (isAgent) return 'message outgoing agent';
        if (isBot) return 'message outgoing bot';
        return 'message incoming';
    };

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
                    const fileName = text || media_url.split('/').pop();
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

    return (
        <>
            <div className={getMessageClass()}>
                <div className="message-container" style={{ position: 'relative' }}>
                    <div className="message-bubble" style={{
                        padding: media_url ? 'var(--space-1)' : undefined,
                        overflow: 'hidden',
                        position: 'relative', // Ensure absolute positioning works if needed, standard flow otherwise
                        minWidth: '120px' // Ensure minimum width for name
                    }}>
                        {/* Agent Name Display - Top Right */}
                        {isAgent && message.agent_name && (
                            <div style={{
                                fontSize: '9px',
                                fontWeight: '600',
                                color: 'rgba(255, 255, 255, 0.7)',
                                textAlign: 'right',
                                marginBottom: '2px',
                                paddingRight: media_url ? '4px' : '0', // Adjust if media
                                paddingTop: media_url ? '4px' : '0'    // Adjust if media
                            }}>
                                {message.agent_name}
                            </div>
                        )}

                        {renderMedia()}
                        {text && !media_type && (
                            <p className="message-text" style={{
                                padding: media_url ? 'var(--space-1) var(--space-2)' : undefined
                            }}>
                                {text}
                            </p>
                        )}
                        {text && media_type && (
                            <p className="message-text" style={{
                                padding: 'var(--space-1) var(--space-2)',
                                fontSize: 'var(--font-size-sm)'
                            }}>
                                {text}
                            </p>
                        )}

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
                    </div>

                    {/* Forward Button */}
                    {onForward && (
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
                            <Share className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {/* CSS to show forward button on hover - Scoped to this message item */}
                <style>{`
                    .message:hover .forward-btn {
                        opacity: 1 !important;
                        pointer-events: auto !important;
                    }
                `}</style>
            </div>

            {/* Full screen image modal */}
            {showFullImage && media_type === 'image' && (
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
            )}
        </>
    );
};

export default MessageBubble;
