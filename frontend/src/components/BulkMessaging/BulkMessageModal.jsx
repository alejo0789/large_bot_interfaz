import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    X, Send, Users, Tag, CheckCircle, AlertCircle,
    Image, Video, Mic, Trash2, Loader, Search
} from 'lucide-react';

/**
 * Enhanced Bulk message modal component
 * Features:
 * - Filter by tags
 * - Manual selection
 * - Media attachments (images, videos, audio)
 * - Real-time progress tracking via Socket.IO
 */
const BulkMessageModal = ({
    isOpen,
    onClose,
    conversations,
    tags,
    tagsByPhone = {},
    onSend,
    socket
}) => {
    const [message, setMessage] = useState('');
    const [selectionMode, setSelectionMode] = useState('all'); // 'all', 'tag', 'manual'
    const [selectedTagIds, setSelectedTagIds] = useState([]);
    const [selectedPhones, setSelectedPhones] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);
    const [manualSearch, setManualSearch] = useState('');

    // Progress tracking
    const [progress, setProgress] = useState(null);
    const [, setBatchId] = useState(null);

    // Media state
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const [mediaType, setMediaType] = useState(null); // 'image', 'video', 'audio'

    const fileInputRef = useRef(null);

    // Listen for bulk send progress via Socket.IO
    useEffect(() => {
        if (!socket) return;

        const handleProgress = (data) => {
            console.log('📊 Bulk send progress:', data);
            setProgress(data);
        };

        const handleComplete = (data) => {
            console.log('✅ Bulk send complete:', data);
            setProgress(null);
            setIsSending(false);
            setSendResult({
                success: true,
                count: data.sent,
                failed: data.failed,
                duration: data.duration
            });

            // Clear form after 3 seconds
            setTimeout(() => {
                setMessage('');
                clearMedia();
                setSendResult(null);
                setBatchId(null);
                onClose();
            }, 3000);
        };

        const handleError = (data) => {
            console.error('❌ Bulk send error:', data);
            setProgress(null);
            setIsSending(false);
            setSendResult({ success: false, error: data.error });
        };

        socket.on('bulk-send-progress', handleProgress);
        socket.on('bulk-send-complete', handleComplete);
        socket.on('bulk-send-error', handleError);

        return () => {
            socket.off('bulk-send-progress', handleProgress);
            socket.off('bulk-send-complete', handleComplete);
            socket.off('bulk-send-error', handleError);
        };
    }, [socket, onClose]);

    // Get conversations filtered by selected tags
    const tagFilteredConversations = useMemo(() => {
        if (!conversations) return [];
        if (selectedTagIds.length === 0) return conversations;

        return conversations.filter(conv => {
            const convTags = tagsByPhone[conv.contact.phone] || [];
            return selectedTagIds.some(tagId =>
                convTags.some(t => t.id === tagId)
            );
        });
    }, [conversations, selectedTagIds, tagsByPhone]);

    // Get recipients based on selection mode
    const recipients = useMemo(() => {
        if (!conversations) return [];
        switch (selectionMode) {
            case 'all':
                return conversations.map(c => c.contact.phone);
            case 'tag':
                return tagFilteredConversations.map(c => c.contact.phone);
            case 'manual':
                return selectedPhones;
            default:
                return [];
        }
    }, [selectionMode, conversations, tagFilteredConversations, selectedPhones]);

    // Helper to clear media
    const clearMedia = () => {
        setMediaFile(null);
        setMediaPreview(null);
        setMediaType(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Early return after all hooks
    if (!isOpen) return null;

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Determine media type
        let detectedType = null;
        if (file.type.startsWith('image/')) detectedType = 'image';
        else if (file.type.startsWith('video/')) detectedType = 'video';
        else if (file.type.startsWith('audio/')) detectedType = 'audio';

        setMediaFile(file);
        setMediaType(detectedType);

        // Create preview for images and videos
        if (detectedType === 'image' || detectedType === 'video') {
            const reader = new FileReader();
            reader.onload = (ev) => setMediaPreview(ev.target.result);
            reader.readAsDataURL(file);
        } else {
            setMediaPreview(file.name);
        }
    };

    const handleSend = async () => {
        if ((!message.trim() && !mediaFile) || recipients.length === 0) return;

        setIsSending(true);
        setSendResult(null);
        setProgress(null);

        try {
            const result = await onSend(recipients, message, mediaFile);

            // If using new bulk system (text only), progress comes via Socket.IO
            // The useEffect will handle completion
            if (result.batchId) {
                setBatchId(result.batchId);
                console.log('📤 Bulk send initiated with batchId:', result.batchId);
                // Don't set isSending to false here - Socket.IO will handle it
                return;
            }

            // For media (sequential) or legacy mode
            setSendResult({ success: true, count: recipients.length });

            // Reset form after success
            setTimeout(() => {
                setMessage('');
                clearMedia();
                setSendResult(null);
                onClose();
            }, 2000);
        } catch (error) {
            setSendResult({ success: false, error: error.message });
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

    const toggleTag = (tagId) => {
        setSelectedTagIds(prev =>
            prev.includes(tagId)
                ? prev.filter(id => id !== tagId)
                : [...prev, tagId]
        );
    };

    const selectAll = () => {
        if (selectionMode === 'tag') {
            setSelectedPhones(tagFilteredConversations.map(c => c.contact.phone));
        } else {
            setSelectedPhones(conversations.map(c => c.contact.phone));
        }
        setSelectionMode('manual');
    };

    const clearSelection = () => {
        setSelectedPhones([]);
        setSelectedTagIds([]);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div className="modal-header" style={{
                    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
                    color: 'white',
                    borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0'
                }}>
                    <h3 className="modal-title" style={{ color: 'white', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Send className="w-5 h-5" />
                        Envío Masivo de Mensajes
                    </h3>
                    <button className="btn btn-icon" onClick={onClose} style={{ color: 'white' }}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
                    {/* Progress bar for bulk send */}
                    {progress && (
                        <div style={{
                            padding: 'var(--space-4)',
                            borderRadius: 'var(--radius-lg)',
                            marginBottom: 'var(--space-4)',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid rgba(99, 102, 241, 0.2)'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: 'var(--space-2)'
                            }}>
                                <span style={{
                                    fontWeight: 600,
                                    color: 'var(--color-gray-700)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-2)'
                                }}>
                                    <Loader className="w-4 h-4" style={{ animation: 'spin 1s linear infinite' }} />
                                    Enviando mensajes...
                                </span>
                                <span style={{ fontWeight: 600, color: '#6366f1' }}>
                                    {progress.progress}%
                                </span>
                            </div>

                            {/* Progress bar */}
                            <div style={{
                                height: '8px',
                                backgroundColor: 'var(--color-gray-200)',
                                borderRadius: 'var(--radius-full)',
                                overflow: 'hidden',
                                marginBottom: 'var(--space-2)'
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: `${progress.progress}%`,
                                    backgroundColor: '#6366f1',
                                    borderRadius: 'var(--radius-full)',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>

                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--color-gray-600)'
                            }}>
                                <span>
                                    ✅ {progress.sent} enviados
                                    {progress.failed > 0 && (
                                        <span style={{ color: 'var(--color-error)', marginLeft: '8px' }}>
                                            ❌ {progress.failed} fallidos
                                        </span>
                                    )}
                                </span>
                                <span>
                                    Lote {progress.currentBatch}/{progress.totalBatches}
                                </span>
                            </div>
                        </div>
                    )}

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
                                        ✅ {sendResult.count} enviados
                                        {sendResult.failed > 0 && ` | ❌ ${sendResult.failed} fallidos`}
                                        {sendResult.duration && ` | ⏱️ ${sendResult.duration}s`}
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

                    {/* Selection mode tabs */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <h4 style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            marginBottom: 'var(--space-2)',
                            color: 'var(--color-gray-700)'
                        }}>
                            Modo de selección
                        </h4>

                        <div style={{
                            display: 'flex',
                            gap: '0',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--color-gray-200)',
                            overflow: 'hidden'
                        }}>
                            <button
                                onClick={() => setSelectionMode('all')}
                                style={{
                                    flex: 1,
                                    padding: 'var(--space-2) var(--space-3)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 'var(--space-1)',
                                    fontSize: 'var(--font-size-sm)',
                                    fontWeight: 500,
                                    backgroundColor: selectionMode === 'all' ? 'var(--color-primary)' : 'white',
                                    color: selectionMode === 'all' ? 'white' : 'var(--color-gray-700)',
                                    transition: 'all var(--transition-fast)'
                                }}
                            >
                                <Users className="w-4 h-4" />
                                Todos ({conversations.length})
                            </button>

                            <button
                                onClick={() => setSelectionMode('tag')}
                                style={{
                                    flex: 1,
                                    padding: 'var(--space-2) var(--space-3)',
                                    border: 'none',
                                    borderLeft: '1px solid var(--color-gray-200)',
                                    borderRight: '1px solid var(--color-gray-200)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 'var(--space-1)',
                                    fontSize: 'var(--font-size-sm)',
                                    fontWeight: 500,
                                    backgroundColor: selectionMode === 'tag' ? 'var(--color-primary)' : 'white',
                                    color: selectionMode === 'tag' ? 'white' : 'var(--color-gray-700)',
                                    transition: 'all var(--transition-fast)'
                                }}
                            >
                                <Tag className="w-4 h-4" />
                                Por etiquetas
                            </button>

                            <button
                                onClick={() => setSelectionMode('manual')}
                                style={{
                                    flex: 1,
                                    padding: 'var(--space-2) var(--space-3)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 'var(--space-1)',
                                    fontSize: 'var(--font-size-sm)',
                                    fontWeight: 500,
                                    backgroundColor: selectionMode === 'manual' ? 'var(--color-primary)' : 'white',
                                    color: selectionMode === 'manual' ? 'white' : 'var(--color-gray-700)',
                                    transition: 'all var(--transition-fast)'
                                }}
                            >
                                ✓ Manual
                            </button>
                        </div>
                    </div>

                    {/* Tag selection - Only show in tag mode */}
                    {selectionMode === 'tag' && (
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <h4 style={{
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 600,
                                marginBottom: 'var(--space-2)',
                                color: 'var(--color-gray-700)'
                            }}>
                                Seleccionar etiquetas
                            </h4>

                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-2)',
                                flexWrap: 'wrap',
                                padding: 'var(--space-3)',
                                backgroundColor: 'var(--color-gray-50)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--color-gray-200)'
                            }}>
                                {tags && tags.length > 0 ? (
                                    tags.map(tag => (
                                        <button
                                            key={tag.id}
                                            onClick={() => toggleTag(tag.id)}
                                            style={{
                                                padding: 'var(--space-1) var(--space-3)',
                                                borderRadius: 'var(--radius-full)',
                                                border: selectedTagIds.includes(tag.id)
                                                    ? `2px solid ${tag.color}`
                                                    : '2px solid transparent',
                                                backgroundColor: selectedTagIds.includes(tag.id)
                                                    ? tag.color
                                                    : 'white',
                                                color: selectedTagIds.includes(tag.id) ? 'white' : tag.color,
                                                cursor: 'pointer',
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: 500,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-1)',
                                                transition: 'all var(--transition-fast)',
                                                boxShadow: selectedTagIds.includes(tag.id)
                                                    ? '0 2px 8px rgba(0,0,0,0.15)'
                                                    : 'none'
                                            }}
                                        >
                                            <Tag className="w-3 h-3" />
                                            {tag.name}
                                        </button>
                                    ))
                                ) : (
                                    <span style={{ color: 'var(--color-gray-500)', fontSize: 'var(--font-size-sm)' }}>
                                        No hay etiquetas disponibles
                                    </span>
                                )}
                            </div>

                            {selectedTagIds.length > 0 && (
                                <p style={{
                                    fontSize: 'var(--font-size-sm)',
                                    color: 'var(--color-primary)',
                                    marginTop: 'var(--space-2)',
                                    fontWeight: 500
                                }}>
                                    ✓ {tagFilteredConversations.length} contactos coinciden con las etiquetas seleccionadas
                                </p>
                            )}
                        </div>
                    )}

                    {/* Manual selection list */}
                    {selectionMode === 'manual' && (
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 'var(--space-2)'
                            }}>
                                <span style={{
                                    fontSize: 'var(--font-size-sm)',
                                    color: 'var(--color-gray-600)',
                                    fontWeight: 500
                                }}>
                                    {selectedPhones.length} de {conversations.length} seleccionados
                                </span>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button
                                        className="btn"
                                        onClick={selectAll}
                                        style={{
                                            padding: '4px 12px',
                                            fontSize: 'var(--font-size-xs)',
                                            backgroundColor: 'var(--color-primary-light)',
                                            color: 'white',
                                            border: 'none'
                                        }}
                                    >
                                        Seleccionar todos
                                    </button>
                                    <button
                                        className="btn"
                                        onClick={clearSelection}
                                        style={{
                                            padding: '4px 12px',
                                            fontSize: 'var(--font-size-xs)',
                                            backgroundColor: 'var(--color-gray-200)',
                                            color: 'var(--color-gray-700)',
                                            border: 'none'
                                        }}
                                    >
                                        Limpiar
                                    </button>
                                </div>
                            </div>

                            <div style={{
                                position: 'relative',
                                marginBottom: 'var(--space-2)'
                            }}>
                                <Search className="w-4 h-4" style={{
                                    position: 'absolute',
                                    left: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--color-gray-400)'
                                }} />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o teléfono..."
                                    value={manualSearch}
                                    onChange={(e) => setManualSearch(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--space-2) var(--space-3) var(--space-2) 36px',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--color-gray-200)',
                                        fontSize: 'var(--font-size-sm)',
                                        outline: 'none focus:ring-2 focus:ring-primary'
                                    }}
                                />
                            </div>

                            <div style={{
                                maxHeight: '180px',
                                overflowY: 'auto',
                                border: '1px solid var(--color-gray-200)',
                                borderRadius: 'var(--radius-lg)',
                                backgroundColor: 'white'
                            }}>
                                {conversations
                                    .filter(conv => {
                                        if (!manualSearch) return true;
                                        const query = manualSearch.toLowerCase();
                                        return (
                                            conv.contact.name?.toLowerCase().includes(query) ||
                                            conv.contact.phone?.includes(query)
                                        );
                                    })
                                    .map(conv => {
                                        const convTags = tagsByPhone[conv.contact.phone] || [];
                                        return (
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
                                                        ? 'var(--color-primary-bg)'
                                                        : 'transparent',
                                                    transition: 'background-color var(--transition-fast)'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPhones.includes(conv.contact.phone)}
                                                    onChange={() => togglePhone(conv.contact.phone)}
                                                    style={{
                                                        accentColor: 'var(--color-primary)',
                                                        width: '16px',
                                                        height: '16px'
                                                    }}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                                                        {conv.contact.name}
                                                    </div>
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)' }}>
                                                        {conv.contact.phone}
                                                    </div>
                                                </div>
                                                {convTags.length > 0 && (
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        {convTags.slice(0, 2).map(tag => (
                                                            <span
                                                                key={tag.id}
                                                                style={{
                                                                    backgroundColor: tag.color,
                                                                    color: 'white',
                                                                    padding: '2px 6px',
                                                                    borderRadius: 'var(--radius-full)',
                                                                    fontSize: '10px',
                                                                    fontWeight: 500
                                                                }}
                                                            >
                                                                {tag.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </label>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* Media attachment section */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <h4 style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            marginBottom: 'var(--space-2)',
                            color: 'var(--color-gray-700)'
                        }}>
                            Adjuntar archivo (opcional)
                        </h4>

                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="image/*,video/*,audio/*"
                            style={{ display: 'none' }}
                        />

                        {!mediaFile ? (
                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-2)',
                                flexWrap: 'wrap'
                            }}>
                                <button
                                    onClick={() => {
                                        fileInputRef.current.accept = 'image/*';
                                        fileInputRef.current.click();
                                    }}
                                    className="media-btn"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-1)',
                                        padding: 'var(--space-2) var(--space-3)',
                                        backgroundColor: 'var(--color-gray-100)',
                                        border: '1px dashed var(--color-gray-300)',
                                        borderRadius: 'var(--radius-lg)',
                                        cursor: 'pointer',
                                        color: 'var(--color-gray-600)',
                                        fontSize: 'var(--font-size-sm)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Image className="w-4 h-4" />
                                    Imagen
                                </button>

                                <button
                                    onClick={() => {
                                        fileInputRef.current.accept = 'video/*';
                                        fileInputRef.current.click();
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-1)',
                                        padding: 'var(--space-2) var(--space-3)',
                                        backgroundColor: 'var(--color-gray-100)',
                                        border: '1px dashed var(--color-gray-300)',
                                        borderRadius: 'var(--radius-lg)',
                                        cursor: 'pointer',
                                        color: 'var(--color-gray-600)',
                                        fontSize: 'var(--font-size-sm)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Video className="w-4 h-4" />
                                    Video
                                </button>

                                <button
                                    onClick={() => {
                                        fileInputRef.current.accept = 'audio/*';
                                        fileInputRef.current.click();
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-1)',
                                        padding: 'var(--space-2) var(--space-3)',
                                        backgroundColor: 'var(--color-gray-100)',
                                        border: '1px dashed var(--color-gray-300)',
                                        borderRadius: 'var(--radius-lg)',
                                        cursor: 'pointer',
                                        color: 'var(--color-gray-600)',
                                        fontSize: 'var(--font-size-sm)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Mic className="w-4 h-4" />
                                    Audio
                                </button>
                            </div>
                        ) : (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                                padding: 'var(--space-3)',
                                backgroundColor: 'var(--color-gray-50)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--color-gray-200)'
                            }}>
                                {/* Preview */}
                                {mediaType === 'image' && mediaPreview && (
                                    <img
                                        src={mediaPreview}
                                        alt="Preview"
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            objectFit: 'cover',
                                            borderRadius: 'var(--radius-md)'
                                        }}
                                    />
                                )}
                                {mediaType === 'video' && mediaPreview && (
                                    <video
                                        src={mediaPreview}
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            objectFit: 'cover',
                                            borderRadius: 'var(--radius-md)'
                                        }}
                                    />
                                )}
                                {mediaType === 'audio' && (
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: 'var(--color-primary)',
                                        borderRadius: 'var(--radius-md)'
                                    }}>
                                        <Mic className="w-8 h-8" style={{ color: 'white' }} />
                                    </div>
                                )}

                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontSize: 'var(--font-size-sm)',
                                        fontWeight: 500,
                                        color: 'var(--color-gray-700)'
                                    }}>
                                        {mediaFile.name}
                                    </div>
                                    <div style={{
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--color-gray-500)'
                                    }}>
                                        {(mediaFile.size / 1024 / 1024).toFixed(2)} MB • {mediaType}
                                    </div>
                                </div>

                                <button
                                    onClick={clearMedia}
                                    style={{
                                        padding: 'var(--space-2)',
                                        backgroundColor: 'var(--color-error)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Message input */}
                    <div style={{ marginBottom: 'var(--space-3)' }}>
                        <h4 style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            marginBottom: 'var(--space-2)',
                            color: 'var(--color-gray-700)'
                        }}>
                            Mensaje {mediaFile ? '(opcional - puede servir como caption)' : ''}
                        </h4>
                        <textarea
                            className="message-input"
                            placeholder="Escribe el mensaje que deseas enviar..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={3}
                            style={{
                                width: '100%',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--color-gray-300)',
                                padding: 'var(--space-3)'
                            }}
                        />
                    </div>

                    {/* Recipients summary */}
                    <div style={{
                        padding: 'var(--space-3)',
                        backgroundColor: 'var(--color-primary-bg)',
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)'
                    }}>
                        <Users className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                        <span style={{
                            color: 'var(--color-primary)',
                            fontWeight: 500,
                            fontSize: 'var(--font-size-sm)'
                        }}>
                            Se enviará a {recipients.length} contacto{recipients.length !== 1 ? 's' : ''}
                            {mediaFile && ` con ${mediaType}`}
                        </span>
                    </div>
                </div>

                <div className="modal-footer" style={{
                    borderTop: '1px solid var(--color-gray-200)',
                    padding: 'var(--space-4)'
                }}>
                    <button
                        className="btn"
                        onClick={onClose}
                        style={{
                            backgroundColor: 'var(--color-gray-200)',
                            color: 'var(--color-gray-700)',
                            padding: 'var(--space-2) var(--space-4)'
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSend}
                        disabled={
                            (!message.trim() && !mediaFile) ||
                            recipients.length === 0 ||
                            isSending
                        }
                        style={{
                            padding: 'var(--space-2) var(--space-4)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)'
                        }}
                    >
                        {isSending ? (
                            'Enviando...'
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Enviar a {recipients.length}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkMessageModal;
