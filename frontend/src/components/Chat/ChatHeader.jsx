import React, { useState, useEffect } from 'react';
import { ArrowLeft, Phone, MoreVertical, User, Bot, UserCheck, Edit2 } from 'lucide-react';
import EditContactModal from '../Sidebar/EditContactModal';

import apiFetch from '../../utils/api';

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
    isSweepMode,
    onNameUpdated,   // optional callback: (phone, newName) => void
    agendasCount = 0 // New prop for agenda counter
}) => {
    const [isEditOpen, setIsEditOpen] = useState(false);
    // Helper para formatear LIDs largos (IDs internos de WA)
    const formatDisplayName = (name, phone) => {
        let nameToDisplay = name || phone || '';
        
        const isNameLid = typeof nameToDisplay === 'string' && (
            nameToDisplay.includes('@lid') || 
            (nameToDisplay.replace(/\D/g, '').length > 13 && !nameToDisplay.startsWith('+')) ||
            nameToDisplay.includes('@s.whatsapp.net') ||
            nameToDisplay.includes('@g.us')
        );

        if (isNameLid || nameToDisplay.toLowerCase() === 'unknown' || nameToDisplay.toLowerCase().startsWith('usuario')) {
            nameToDisplay = phone || '';
        }

        if (typeof nameToDisplay === 'string') {
            const digits = nameToDisplay.replace(/\D/g, '');
            if (digits.length > 13 && !nameToDisplay.startsWith('+')) {
                nameToDisplay = `Usuario ${digits.slice(-4)}`;
            }
        }
        
        return nameToDisplay;
    };

    const [displayName, setDisplayName] = useState(() => formatDisplayName(conversation?.contact?.name, conversation?.contact?.phone));

    useEffect(() => {
        setDisplayName(formatDisplayName(conversation?.contact?.name, conversation?.contact?.phone));
    }, [conversation?.contact?.name, conversation?.contact?.phone]);

    if (!conversation) return null;

    const { contact } = conversation;

    const handleSaveName = async (newName) => {
        const res = await apiFetch('/api/conversations/update-contact-name', {
            method: 'PUT',
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
                    {(isMobile || isSweepMode) && (
                        <button
                            className="btn btn-icon"
                            onClick={onBack}
                            title={isSweepMode ? "Volver y seguir con la siguiente (Escobita)" : "Volver"}
                            style={{
                                color: isSweepMode ? 'var(--color-primary)' : 'inherit',
                                backgroundColor: isSweepMode ? 'rgba(7,94,84,0.1)' : 'transparent',
                                borderRadius: '8px',
                                padding: '6px'
                            }}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}

                    <div className="conversation-avatar" style={{ width: '40px', height: '40px', padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0', flexShrink: 0 }}>
                        {(() => {
                            const tenantStr = localStorage.getItem('current_tenant');
                            let tenantSlug = '';
                            try {
                                if (tenantStr) tenantSlug = JSON.parse(tenantStr)?.slug;
                            } catch (e) { }
                            const avatarUrl = `${API_URL}/api/conversations/${contact.phone}/avatar${tenantSlug ? `?sede=${tenantSlug}` : ''}`;
                            return (
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
                            );
                        })()}
                        <User className="w-5 h-5" style={{ display: 'none', color: '#9ca3af' }} />
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
                            {(typeof contact.phone === 'string' && contact.phone.replace(/\D/g, '').length > 13 && !contact.phone.startsWith('+')) 
                                ? `ID Interno (${contact.phone.slice(-4)})` 
                                : contact.phone}
                        </p>
                    </div>
                </div>

                <div className="chat-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    
                    {/* Daily Agendas Counter */}
                    {/* Daily Agendas Counter (Subtle version) */}
                    {!isMobile && agendasCount > 0 && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: 'var(--color-gray-100)',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--color-gray-200)',
                        }}>
                            <div style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'white',
                                width: '18px',
                                height: '18px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: '700'
                            }}>
                                {agendasCount}
                            </div>
                            <span style={{ 
                                fontSize: '11px', 
                                fontWeight: 600, 
                                color: 'var(--color-gray-600)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                                whiteSpace: 'nowrap'
                            }}>
                                Agendas
                            </span>
                        </div>
                    )}

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
