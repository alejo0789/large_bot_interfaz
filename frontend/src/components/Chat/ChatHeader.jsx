import React, { useState, useEffect } from 'react';
import { ArrowLeft, Phone, MoreVertical, User, Bot, UserCheck, Edit2 } from 'lucide-react';
import EditContactModal from '../Sidebar/EditContactModal';

const API_URL = (() => {
    if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL)
        return process.env.REACT_APP_API_URL;
    if (window.location.hostname !== 'localhost')
        return 'https://largebotinterfaz-production-5b38.up.railway.app';
    return 'http://localhost:4000';
})();

/**
 * Chat header component with AI toggle and inline name editing
 */
const ChatHeader = ({
    conversation,
    aiEnabled,
    onToggleAI,
    onMarkUnread,
    onBack,
    isMobile,
    onNameUpdated   // optional callback: (phone, newName) => void
}) => {
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [displayName, setDisplayName] = useState('');

    useEffect(() => {
        setDisplayName(conversation?.contact?.name || '');
    }, [conversation?.contact?.name]);

    if (!conversation) return null;

    const { contact } = conversation;

    const handleSaveName = async (newName) => {
        const res = await fetch(`${API_URL}/api/conversations/update-contact-name`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: contact.phone, name: newName })
        });

        if (!res.ok) throw new Error('No se pudo guardar el nombre');

        setDisplayName(newName);
        if (onNameUpdated) onNameUpdated(contact.phone, newName);
    };

    return (
        <>
            <div className="chat-header">
                <div className="chat-header-info" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
                    {isMobile && (
                        <button className="btn btn-icon" onClick={onBack}>
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}

                    <div className="conversation-avatar" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                        <User className="w-5 h-5" />
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                        {/* Name row with pencil edit button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <h2 style={{
                                fontSize: isMobile ? 'var(--font-size-base)' : 'var(--font-size-lg)',
                                fontWeight: 600,
                                color: 'var(--color-gray-900)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                margin: 0
                            }}>
                                {displayName}
                            </h2>

                            {/* Pencil button */}
                            <button
                                onClick={() => setIsEditOpen(true)}
                                title="Editar nombre"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '3px',
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    color: 'var(--color-gray-400)',
                                    borderRadius: '4px',
                                    flexShrink: 0,
                                    transition: 'color 0.15s, background 0.15s'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.color = 'var(--color-primary)';
                                    e.currentTarget.style.background = 'rgba(7,94,84,0.08)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.color = 'var(--color-gray-400)';
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <Edit2 size={13} />
                            </button>
                        </div>

                        <p style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-gray-500)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            margin: 0
                        }}>
                            {contact.phone}
                        </p>
                    </div>
                </div>

                <div className="chat-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>

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
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleAI(contact.phone);
                            }}
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

            {/* Edit name modal */}
            <EditContactModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                initialName={displayName}
                onSave={handleSaveName}
                contactPhone={contact.phone}
            />
        </>
    );
};

export default ChatHeader;
