import React, { useState, useMemo } from 'react';
import { X, Send, Users, Tag, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * Bulk message modal component
 */
const BulkMessageModal = ({
    isOpen,
    onClose,
    conversations,
    tags,
    onSend
}) => {
    const [message, setMessage] = useState('');
    const [selectionMode, setSelectionMode] = useState('all'); // 'all', 'tag', 'manual'
    const [selectedTagId, setSelectedTagId] = useState(null);
    const [selectedPhones, setSelectedPhones] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);

    // Get recipients based on selection mode - must be before early return
    const recipients = useMemo(() => {
        if (!conversations) return [];
        switch (selectionMode) {
            case 'all':
                return conversations.map(c => c.contact.phone);
            case 'tag':
                // Filter by tag (you would need tagsByPhone data)
                return selectedPhones;
            case 'manual':
                return selectedPhones;
            default:
                return [];
        }
    }, [selectionMode, conversations, selectedPhones, selectedTagId]);

    // Early return after all hooks
    if (!isOpen) return null;

    const handleSend = async () => {
        if (!message.trim() || recipients.length === 0) return;

        setIsSending(true);
        setSendResult(null);

        try {
            // Call the bulk send function
            const result = await onSend(recipients, message);
            setSendResult({ success: true, count: recipients.length });

            // Reset form after success
            setTimeout(() => {
                setMessage('');
                setSendResult(null);
                onClose();
            }, 2000);
        } catch (error) {
            setSendResult({ success: false, error: error.message });
        } finally {
            setIsSending(false);
        }
    };

    const togglePhone = (phone) => {
        setSelectedPhones(prev =>
            prev.includes(phone)
                ? prev.filter(p => p !== phone)
                : [...prev, phone]
        );
    };

    const selectAll = () => {
        setSelectedPhones(conversations.map(c => c.contact.phone));
    };

    const clearSelection = () => {
        setSelectedPhones([]);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                    <h3 className="modal-title">
                        <Users className="w-5 h-5" style={{ marginRight: 'var(--space-2)', display: 'inline' }} />
                        Envío Masivo de Mensajes
                    </h3>
                    <button className="btn btn-icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Send result message */}
                    {sendResult && (
                        <div style={{
                            padding: 'var(--space-3)',
                            borderRadius: 'var(--radius-lg)',
                            marginBottom: 'var(--space-4)',
                            backgroundColor: sendResult.success
                                ? 'rgba(16, 185, 129, 0.1)'
                                : 'rgba(239, 68, 68, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)'
                        }}>
                            {sendResult.success ? (
                                <>
                                    <CheckCircle className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
                                    <span style={{ color: 'var(--color-success)' }}>
                                        Mensaje enviado a {sendResult.count} contactos
                                    </span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-5 h-5" style={{ color: 'var(--color-error)' }} />
                                    <span style={{ color: 'var(--color-error)' }}>
                                        Error: {sendResult.error}
                                    </span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Selection mode */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <h4 style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            marginBottom: 'var(--space-2)',
                            color: 'var(--color-gray-700)'
                        }}>
                            Seleccionar destinatarios
                        </h4>

                        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            <button
                                className={`btn ${selectionMode === 'all' ? 'btn-primary' : ''}`}
                                onClick={() => setSelectionMode('all')}
                                style={selectionMode !== 'all' ? {
                                    backgroundColor: 'var(--color-gray-100)',
                                    color: 'var(--color-gray-700)'
                                } : {}}
                            >
                                <Users className="w-4 h-4" />
                                Todos ({conversations.length})
                            </button>

                            <button
                                className={`btn ${selectionMode === 'manual' ? 'btn-primary' : ''}`}
                                onClick={() => setSelectionMode('manual')}
                                style={selectionMode !== 'manual' ? {
                                    backgroundColor: 'var(--color-gray-100)',
                                    color: 'var(--color-gray-700)'
                                } : {}}
                            >
                                Selección manual
                            </button>
                        </div>
                    </div>

                    {/* Manual selection */}
                    {selectionMode === 'manual' && (
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 'var(--space-2)'
                            }}>
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-600)' }}>
                                    {selectedPhones.length} seleccionados
                                </span>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button
                                        className="btn"
                                        onClick={selectAll}
                                        style={{
                                            padding: '4px 8px',
                                            fontSize: 'var(--font-size-xs)',
                                            backgroundColor: 'var(--color-gray-100)',
                                            color: 'var(--color-gray-700)'
                                        }}
                                    >
                                        Seleccionar todos
                                    </button>
                                    <button
                                        className="btn"
                                        onClick={clearSelection}
                                        style={{
                                            padding: '4px 8px',
                                            fontSize: 'var(--font-size-xs)',
                                            backgroundColor: 'var(--color-gray-100)',
                                            color: 'var(--color-gray-700)'
                                        }}
                                    >
                                        Limpiar
                                    </button>
                                </div>
                            </div>

                            <div style={{
                                maxHeight: '200px',
                                overflowY: 'auto',
                                border: '1px solid var(--color-gray-200)',
                                borderRadius: 'var(--radius-lg)'
                            }}>
                                {conversations.map(conv => (
                                    <label
                                        key={conv.contact.phone}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-2)',
                                            padding: 'var(--space-2) var(--space-3)',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid var(--color-gray-100)',
                                            backgroundColor: selectedPhones.includes(conv.contact.phone)
                                                ? 'var(--color-gray-50)'
                                                : 'transparent'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedPhones.includes(conv.contact.phone)}
                                            onChange={() => togglePhone(conv.contact.phone)}
                                            style={{ accentColor: 'var(--color-primary)' }}
                                        />
                                        <div>
                                            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                                                {conv.contact.name}
                                            </div>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)' }}>
                                                {conv.contact.phone}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Message input */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <h4 style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            marginBottom: 'var(--space-2)',
                            color: 'var(--color-gray-700)'
                        }}>
                            Mensaje
                        </h4>
                        <textarea
                            className="message-input"
                            placeholder="Escribe el mensaje que deseas enviar..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={4}
                            style={{
                                width: '100%',
                                resize: 'vertical',
                                fontFamily: 'inherit'
                            }}
                        />
                        <p style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-gray-500)',
                            marginTop: 'var(--space-1)'
                        }}>
                            Este mensaje se enviará a {
                                selectionMode === 'all'
                                    ? conversations.length
                                    : selectedPhones.length
                            } contactos
                        </p>
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        className="btn"
                        onClick={onClose}
                        style={{ backgroundColor: 'var(--color-gray-200)', color: 'var(--color-gray-700)' }}
                    >
                        Cancelar
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSend}
                        disabled={
                            !message.trim() ||
                            (selectionMode === 'manual' && selectedPhones.length === 0) ||
                            isSending
                        }
                    >
                        {isSending ? (
                            'Enviando...'
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Enviar a {selectionMode === 'all' ? conversations.length : selectedPhones.length}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkMessageModal;
