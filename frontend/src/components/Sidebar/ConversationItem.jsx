import React from 'react';
import { User, Bot, UserCheck, Tag } from 'lucide-react';

/**
 * Conversation item component
 */
const ConversationItem = ({
    conversation,
    isSelected,
    aiEnabled,
    tags = [],
    onClick,
    onTagClick
}) => {
    const { contact, lastMessage, timestamp, unread } = conversation;
    const hasUnread = unread > 0;

    return (
        <div
            className={`conversation-item ${isSelected ? 'active' : ''}`}
            onClick={onClick}
            style={{
                backgroundColor: hasUnread && !isSelected
                    ? 'rgba(18, 140, 126, 0.05)'
                    : undefined,
                borderLeft: hasUnread && !isSelected
                    ? '3px solid var(--color-primary-light)'
                    : undefined,
                position: 'relative' // For absolute positioning of tag button if needed, but flex is better
            }}
        >
            {/* Avatar with unread indicator */}
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
                    <span className="conversation-name" style={{
                        fontWeight: hasUnread ? 700 : 600,
                        color: hasUnread ? 'var(--color-gray-900)' : undefined,
                        maxWidth: '60%' // Limit name width to avoid crowding status
                    }}>
                        {contact.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {/* Tag Button - Only visible on hover or if already has tags (optional, but requested "without opening") */}
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

                        {/* AI Status indicator */}
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

                    {/* Tags */}
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

                    {/* Unread badge - more prominent */}
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
        </div>
    );
};

export default ConversationItem;

