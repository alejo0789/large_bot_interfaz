import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Image as ImageIcon, Sparkles, Zap, Command, MessageSquare, Smile, Upload, Trash2 } from 'lucide-react';
import { useQuickReplies } from '../../hooks/useQuickReplies';
import EmojiPicker from 'emoji-picker-react';

const QuickReplyManager = ({ isOpen, onClose, initialContent = '' }) => {
    const { createQuickReply, uploadQuickReplyMedia } = useQuickReplies();
    const [shortcut, setShortcut] = useState('');
    const [content, setContent] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [error, setError] = useState('');

    const fileInputRef = useRef(null);
    const textAreaRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const emojiButtonRef = useRef(null);

    // Close emoji picker on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (showEmojiPicker &&
                emojiPickerRef.current &&
                !emojiPickerRef.current.contains(event.target) &&
                emojiButtonRef.current &&
                !emojiButtonRef.current.contains(event.target)) {
                setShowEmojiPicker(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showEmojiPicker]);

    useEffect(() => {
        if (isOpen) {
            setContent(initialContent);
            if (initialContent) {
                const words = initialContent.split(' ').slice(0, 2).join('').toLowerCase();
                setShortcut(words.replace(/[^a-z0-9]/g, ''));
            }
            // Reset files and picker
            setSelectedFile(null);
            setFilePreview(null);
            setMediaUrl('');
            setShowEmojiPicker(false);
        }
    }, [isOpen, initialContent]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Por favor sube solo imágenes');
                return;
            }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onload = (e) => setFilePreview(e.target.result);
            reader.readAsDataURL(file);
        }
    };

    const handleEmojiClick = (emojiData) => {
        const emoji = emojiData.emoji;
        const start = textAreaRef.current.selectionStart;
        const end = textAreaRef.current.selectionEnd;
        const newText = content.substring(0, start) + emoji + content.substring(end);
        setContent(newText);

        // Return focus to textarea and set cursor position correctly
        setTimeout(() => {
            if (textAreaRef.current) {
                textAreaRef.current.focus();
                const newPos = start + emoji.length;
                textAreaRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            let finalMediaUrl = mediaUrl;

            // If there's a file, upload it first
            if (selectedFile) {
                const uploadResult = await uploadQuickReplyMedia(selectedFile);
                finalMediaUrl = uploadResult.url;
            }

            await createQuickReply({
                shortcut: shortcut.toLowerCase(),
                content,
                mediaUrl: finalMediaUrl || null,
                mediaType: finalMediaUrl ? 'image' : null
            });
            onClose();
        } catch (err) {
            setError(err.message || 'Error al guardar la respuesta rápida');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{
            backdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'fixed',
            inset: 0,
            zIndex: 1000
        }}>
            <div className="modal" style={{
                maxWidth: '520px',
                width: '95%',
                background: 'var(--color-white)',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.05)',
                overflow: 'visible',
                animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Header with Gradient */}
                <div style={{
                    padding: '24px 32px',
                    background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                            <div style={{
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                padding: '8px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Zap className="w-5 h-5" />
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Atajos Inteligentes</h2>
                        </div>
                        <p style={{ margin: 0, opacity: 0.8, fontSize: '0.875rem' }}>Crea respuestas automáticas para ganar tiempo</p>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            padding: '10px',
                            borderRadius: '50%',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            transition: 'all 0.2s',
                            zIndex: 1
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Decorative abstract circle */}
                    <div style={{
                        position: 'absolute',
                        top: '-20px',
                        right: '-20px',
                        width: '120px',
                        height: '120px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                        zIndex: 0
                    }} />
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
                    {error && (
                        <div style={{
                            padding: '16px',
                            backgroundColor: '#FEF2F2',
                            color: '#B91C1C',
                            borderRadius: '16px',
                            fontSize: '0.875rem',
                            marginBottom: '24px',
                            border: '1px solid #FCA5A5',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <div style={{ backgroundColor: '#EF4444', color: 'white', padding: '4px', borderRadius: '50%' }}>
                                <X className="w-3 h-3" />
                            </div>
                            {error}
                        </div>
                    )}

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--color-gray-700)',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <Command className="w-4 h-4" /> Atajo del Teclado
                        </label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <span style={{
                                position: 'absolute',
                                left: '16px',
                                color: 'var(--color-primary)',
                                fontWeight: 700,
                                fontSize: '1.1rem'
                            }}>/</span>
                            <input
                                type="text"
                                value={shortcut}
                                onChange={(e) => setShortcut(e.target.value.replace(/\s+/g, '').toLowerCase())}
                                placeholder="ej. bienvenida"
                                style={{
                                    width: '100%',
                                    padding: '14px 14px 14px 34px',
                                    borderRadius: '16px',
                                    border: '2px solid var(--color-gray-100)',
                                    background: 'var(--color-gray-50)',
                                    fontSize: '1rem',
                                    fontWeight: 500,
                                    outline: 'none',
                                    transition: 'all 0.2s',
                                    color: 'var(--color-gray-900)'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = 'var(--color-primary)';
                                    e.target.style.background = 'white';
                                    e.target.style.boxShadow = '0 0 0 4px rgba(18, 140, 126, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = 'var(--color-gray-100)';
                                    e.target.style.background = 'var(--color-gray-50)';
                                    e.target.style.boxShadow = 'none';
                                }}
                                required
                            />
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginTop: '6px', marginLeft: '4px' }}>
                            Escribe <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>/{shortcut || 'atajo'}</span> en el chat para disparar esta respuesta.
                        </p>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                color: 'var(--color-gray-700)'
                            }}>
                                <MessageSquare className="w-4 h-4" /> Cuerpo del Mensaje
                            </label>

                            <div style={{ position: 'relative' }}>
                                <button
                                    ref={emojiButtonRef}
                                    type="button"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--color-primary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '0.875rem',
                                        fontWeight: 600
                                    }}
                                >
                                    <Smile className="w-4 h-4" /> Emojis
                                </button>

                                {showEmojiPicker && (
                                    <div
                                        ref={emojiPickerRef}
                                        style={{
                                            position: 'absolute',
                                            bottom: '100%',
                                            right: 0,
                                            marginBottom: '10px',
                                            zIndex: 1000,
                                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                            borderRadius: '16px',
                                            overflow: 'hidden',
                                            background: 'white',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}
                                    >
                                        {/* Picker Header with Close Button */}
                                        <div style={{
                                            padding: '8px 12px',
                                            display: 'flex',
                                            justifyContent: 'flex-end',
                                            borderBottom: '1px solid var(--color-gray-100)',
                                            background: 'var(--color-gray-50)'
                                        }}>
                                            <button
                                                type="button"
                                                onClick={() => setShowEmojiPicker(false)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--color-gray-400)',
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: '50%'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.color = '#EF4444'}
                                                onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-gray-400)'}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <EmojiPicker
                                            onEmojiClick={handleEmojiClick}
                                            autoFocusSearch={false}
                                            theme="light"
                                            width={320}
                                            height={400}
                                            searchPlaceholder="Buscar emoji..."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <textarea
                            ref={textAreaRef}
                            value={content}
                            onChange={(e) => {
                                setContent(e.target.value);
                                if (showEmojiPicker) setShowEmojiPicker(false);
                            }}
                            placeholder="Escribe el mensaje automático..."
                            rows={4}
                            required
                            style={{
                                width: '100%',
                                padding: '16px',
                                borderRadius: '16px',
                                border: '2px solid var(--color-gray-100)',
                                background: 'var(--color-gray-50)',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.2s',
                                resize: 'none',
                                color: 'var(--color-gray-900)',
                                lineHeight: '1.6'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = 'var(--color-primary)';
                                e.target.style.background = 'white';
                                e.target.style.boxShadow = '0 0 0 4px rgba(18, 140, 126, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = 'var(--color-gray-100)';
                                e.target.style.background = 'var(--color-gray-50)';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--color-gray-700)',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <ImageIcon className="w-4 h-4" /> Multimedia (Opcional)
                        </label>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />

                        {!filePreview ? (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current.click()}
                                style={{
                                    width: '100%',
                                    padding: '24px',
                                    borderRadius: '16px',
                                    border: '2px dashed var(--color-gray-200)',
                                    background: 'var(--color-gray-50)',
                                    color: 'var(--color-gray-500)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = 'var(--color-gray-100)';
                                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                                    e.currentTarget.style.color = 'var(--color-primary)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = 'var(--color-gray-50)';
                                    e.currentTarget.style.borderColor = 'var(--color-gray-200)';
                                    e.currentTarget.style.color = 'var(--color-gray-500)';
                                }}
                            >
                                <Upload className="w-8 h-8" />
                                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Subir imagen desde galería</span>
                                <span style={{ fontSize: '0.75rem' }}>JPG, PNG o GIF (Máx. 5MB)</span>
                            </button>
                        ) : (
                            <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', height: '140px' }}>
                                <img src={filePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    padding: '12px',
                                    justifyContent: 'space-between'
                                }}>
                                    <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: 600 }}>{selectedFile.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                                        style={{ background: 'white', border: 'none', color: '#EF4444', padding: '6px', borderRadius: '50%', cursor: 'pointer' }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        paddingTop: '8px'
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '14px',
                                border: '1px solid var(--color-gray-200)',
                                background: 'white',
                                color: 'var(--color-gray-600)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = 'var(--color-gray-50)';
                                e.currentTarget.style.borderColor = 'var(--color-gray-300)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'white';
                                e.currentTarget.style.borderColor = 'var(--color-gray-200)';
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !shortcut || !content}
                            style={{
                                padding: '12px 32px',
                                borderRadius: '14px',
                                border: 'none',
                                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
                                color: 'white',
                                fontWeight: 700,
                                cursor: (isSubmitting || !shortcut || !content) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 8px 16px -4px rgba(18, 140, 126, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                opacity: (isSubmitting || !shortcut || !content) ? 0.6 : 1,
                                transform: 'translateY(0)'
                            }}
                            onMouseOver={(e) => {
                                if (!(isSubmitting || !shortcut || !content)) {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 12px 20px -4px rgba(18, 140, 126, 0.4)';
                                }
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 8px 16px -4px rgba(18, 140, 126, 0.3)';
                            }}
                        >
                            {isSubmitting ? (
                                <>
                                    <Sparkles className="w-4 h-4 animate-spin" /> Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" /> Guardar Atajo
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
                @keyframes modalSlideUp {
                    from { opacity: 0; transform: translateY(40px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default QuickReplyManager;
