import React from 'react';
import { ArrowLeft, Phone, MoreVertical, User, Bot, UserCheck } from 'lucide-react';

/**
 * Chat header component with AI toggle
 */
const ChatHeader = ({
    conversation,
    aiEnabled,
    onToggleAI,
    onBack,
    isMobile
}) => {
    if (!conversation) return null;

    const { contact } = conversation;

    return (
        <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
                {isMobile && (
                    <button className="btn btn-icon" onClick={onBack}>
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                )}

                <div className="conversation-avatar" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                    <User className="w-5 h-5" />
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                    <h2 style={{
                        fontSize: isMobile ? 'var(--font-size-base)' : 'var(--font-size-lg)',
                        fontWeight: 600,
                        color: 'var(--color-gray-900)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {contact.name}
                    </h2>
                    <p style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-gray-500)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {contact.phone}
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                {/* AI Toggle */}
                <div className="ai-toggle">
                    {!isMobile && (
                        <span className={`ai-toggle-label ${!aiEnabled ? 'active' : ''}`}>
                            <UserCheck className="w-4 h-4" style={{ marginRight: '4px', display: 'inline' }} />
                            Manual
                        </span>
                    )}

                    <button
                        className={`toggle-switch ${aiEnabled ? 'active' : ''}`}
                        onClick={() => onToggleAI(contact.phone)}
                        title={aiEnabled ? 'IA Activa - Click para desactivar' : 'IA Desactivada - Click para activar'}
                    >
                        <span className="toggle-switch-handle" />
                    </button>

                    {!isMobile && (
                        <span className={`ai-toggle-label ${aiEnabled ? 'active' : ''}`}>
                            <Bot className="w-4 h-4" style={{ marginRight: '4px', display: 'inline' }} />
                            IA
                        </span>
                    )}
                </div>

                {/* Status indicator */}
                <div className={`status-indicator ${aiEnabled ? 'status-ai' : 'status-manual'}`}>
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

                {!isMobile && (
                    <>
                        <button className="btn btn-icon" title="Llamar">
                            <Phone className="w-5 h-5" />
                        </button>
                        <button className="btn btn-icon" title="Más opciones">
                            <MoreVertical className="w-5 h-5" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatHeader;
