import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Image, FileText, Film, Mic, Square, Trash2, Smile, Zap, Plus, Edit2 } from 'lucide-react';
import { useQuickReplies } from '../../hooks/useQuickReplies';
import QuickReplyManager from '../QuickReplies/QuickReplyManager';
import EmojiPicker from 'emoji-picker-react';

/**
 * Message input component with file attachment and voice recording
 */
const MessageInput = ({ onSend, onSendFile, disabled, isMobile }) => {
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
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

    // Quick Replies State
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [quickReplyFilter, setQuickReplyFilter] = useState('');
    const [showQuickReplyManager, setShowQuickReplyManager] = useState(false);
    const [editingQuickReply, setEditingQuickReply] = useState(null);

    // Load quick replies
    const { quickReplies, fetchQuickReplies, deleteQuickReply } = useQuickReplies();

    // Check for quick reply trigger
    useEffect(() => {
        const lastSlashIndex = message.lastIndexOf('/');
        if (lastSlashIndex !== -1) {
            const textAfterSlash = message.substring(lastSlashIndex + 1);
            // Only trigger if no spaces after last slash (part of the shortcut)
            if (!textAfterSlash.includes(' ')) {
                setQuickReplyFilter(textAfterSlash.toLowerCase());
                setShowQuickReplies(true);
                return;
            }
        }
        setShowQuickReplies(false);
    }, [message]);

    const handleQuickReplySelect = async (reply) => {
        const lastSlashIndex = message.lastIndexOf('/');
        const textBeforeSlash = message.substring(0, lastSlashIndex);

        setMessage(textBeforeSlash + reply.content + ' ');
        setShowQuickReplies(false);

        // Handle Media Attachment
        if (reply.media_url) {
            setIsUploading(true); // Show loading state while fetching media
            try {
                let url = reply.media_url;

                // Fix: If on mobile/remote device and URL is localhost, try to replace with current hostname
                if (url.includes('localhost') && window.location.hostname !== 'localhost') {
                    url = url.replace('localhost', window.location.hostname);
                }

                console.log('Fetching media from:', url);
                const response = await fetch(url);

                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const blob = await response.blob();

                // Determine file name and type
                const filename = url.split('/').pop() || 'media_attachment';
                const file = new File([blob], filename, { type: blob.type });

                setSelectedFile(file);

                // Generate Preview if Image
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => setFilePreview(e.target.result);
                    reader.readAsDataURL(file);
                } else {
                    setFilePreview(null);
                }

            } catch (error) {
                console.error('Error fetching quick reply media:', error);
                alert(`Error al cargar la imagen: ${error.message}`);
                // Clear the potentially partial file state
                setSelectedFile(null);
                setFilePreview(null);
            } finally {
                setIsUploading(false);
            }
        }
    };

    const filteredReplies = quickReplies.filter(qr =>
        qr.shortcut.toLowerCase().includes(quickReplyFilter) ||
        qr.content.toLowerCase().includes(quickReplyFilter)
    );

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [audioWaveform, setAudioWaveform] = useState([]);
    const handleEmojiClick = (emojiData) => {
        const emoji = emojiData.emoji;
        const textarea = document.querySelector('.message-input');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = message.substring(0, start) + emoji + message.substring(end);

        setMessage(newText);

        // Return focus to textarea and set cursor position correctly
        setTimeout(() => {
            textarea.focus();
            const newPos = start + emoji.length;
            textarea.setSelectionRange(newPos, newPos);
        }, 0);
    };

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);

    // Format recording time
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Start voice recording
    const startRecording = async () => {
        try {
            // Check for browser support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('Tu navegador no soporta grabación de audio. Asegúrate de usar HTTPS.');
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Detect supported MIME types for maximum compatibility (iOS/Safari vs Android/Chrome)
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/mp4',
                'audio/ogg;codecs=opus',
                'audio/webm',
                'audio/aac'
            ];

            let supportedMimeType = '';
            for (const type of mimeTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    supportedMimeType = type;
                    break;
                }
            }

            console.log(`🎙️ Using supported MIME type: ${supportedMimeType || 'browser default'}`);

            // Create audio context for visualization (User gesture requirement)
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContextClass();

            // Resume context if suspended (common in PWAs/Safari)
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            // Start visualization
            const updateWaveform = () => {
                if (!analyserRef.current) return;
                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(dataArray);

                // Get 20 bars from the frequency data
                const bars = [];
                const step = Math.floor(dataArray.length / 20);
                for (let i = 0; i < 20; i++) {
                    const value = dataArray[i * step] / 255;
                    bars.push(value);
                }
                setAudioWaveform(bars);
                animationRef.current = requestAnimationFrame(updateWaveform);
            };
            updateWaveform();

            // Create media recorder with supported settings
            const options = supportedMimeType ? { mimeType: supportedMimeType } : {};
            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                // Use the same MIME type used for recording
                const finalType = supportedMimeType || mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: finalType });

                console.log(`🔊 Recording stopped. Size: ${audioBlob.size} bytes, Type: ${finalType}`);

                setAudioBlob(audioBlob);
                setAudioUrl(URL.createObjectURL(audioBlob));
                stream.getTracks().forEach(track => track.stop());
                audioContext.close();
            };

            mediaRecorder.start(1000); // Collect data every second for safety
            setIsRecording(true);
            setRecordingTime(0);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('❌ Error accessing microphone:', error);
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                alert('Permiso denegado. Habilita el micrófono en la configuración de tu navegador.');
            } else if (error.name === 'NotFoundError') {
                alert('No se encontró ningún micrófono conectado.');
            } else {
                alert(`Error al iniciar grabación: ${error.message}`);
            }
        }
    };

    // Stop recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            setAudioWaveform([]);
        }
    };

    // Cancel recording
    const cancelRecording = () => {
        stopRecording();
        setAudioBlob(null);
        setAudioUrl(null);
        setRecordingTime(0);
    };

    // Send audio
    const sendAudio = async () => {
        if (!audioBlob || !onSendFile) return;

        setIsUploading(true);
        try {
            // Determine extension based on actual blob type
            const extension = audioBlob.type.includes('mp4') ? 'mp4' :
                audioBlob.type.includes('ogg') ? 'ogg' : 'webm';

            // Create a file from the blob with the correct type
            const audioFile = new File([audioBlob], `audio_${Date.now()}.${extension}`, { type: audioBlob.type });
            await onSendFile(audioFile, '');
            cancelRecording();
        } catch (error) {
            console.error('Error sending audio:', error);
            alert('Error al enviar el audio');
        } finally {
            setIsUploading(false);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    const handleSubmit = (e) => {
        e?.preventDefault();
        if (audioBlob) {
            sendAudio();
        } else if (selectedFile) {
            handleSendFile();
        } else if (message.trim() && !disabled) {
            onSend(message.trim());
            setMessage('');
            setShowEmojiPicker(false);
        }
    };


    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 16 * 1024 * 1024) {
                alert('El archivo es muy grande. Máximo 16MB.');
                return;
            }
            setSelectedFile(file);
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => setFilePreview(e.target.result);
                reader.readAsDataURL(file);
            } else {
                setFilePreview(null);
            }
        }
    };

    const handleSendFile = async () => {
        if (!selectedFile || !onSendFile) return;
        setIsUploading(true);
        try {
            await onSendFile(selectedFile, message.trim());
            clearFile();
            setMessage('');
        } catch (error) {
            console.error('Error enviando archivo:', error);
            alert('Error al enviar el archivo');
        } finally {
            setIsUploading(false);
        }
    };

    const clearFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const getFileIcon = (type) => {
        if (type.startsWith('image/')) return <Image className="w-5 h-5" />;
        if (type.startsWith('video/')) return <Film className="w-5 h-5" />;
        if (type.startsWith('audio/')) return <Mic className="w-5 h-5" />;
        return <FileText className="w-5 h-5" />;
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // If recording or has recorded audio, show recording UI
    if (isRecording || audioBlob) {
        return (
            <div style={{ width: '100%' }}>
                <div className="chat-input-container" style={{
                    backgroundColor: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-gray-50)'
                }}>
                    {/* Cancel button */}
                    <button
                        className="btn btn-icon"
                        onClick={cancelRecording}
                        title="Cancelar"
                        style={{ color: 'var(--color-error)' }}
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>

                    {/* Recording visualization */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: '0 var(--space-2)'
                    }}>
                        {isRecording ? (
                            <>
                                {/* Recording indicator */}
                                <div style={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--color-error)',
                                    animation: 'pulse 1s infinite'
                                }} />

                                {/* Waveform */}
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '2px',
                                    height: '40px'
                                }}>
                                    {audioWaveform.map((value, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                width: '3px',
                                                height: `${Math.max(4, value * 36)}px`,
                                                backgroundColor: 'var(--color-primary)',
                                                borderRadius: '2px',
                                                transition: 'height 0.1s ease'
                                            }}
                                        />
                                    ))}
                                    {audioWaveform.length === 0 && Array(20).fill(0).map((_, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                width: '3px',
                                                height: '4px',
                                                backgroundColor: 'var(--color-gray-300)',
                                                borderRadius: '2px'
                                            }}
                                        />
                                    ))}
                                </div>

                                {/* Timer */}
                                <span style={{
                                    fontSize: 'var(--font-size-sm)',
                                    fontWeight: 500,
                                    color: 'var(--color-error)',
                                    minWidth: '45px'
                                }}>
                                    {formatTime(recordingTime)}
                                </span>
                            </>
                        ) : (
                            <>
                                {/* Audio preview */}
                                <Mic className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                                <audio
                                    src={audioUrl}
                                    controls
                                    style={{
                                        flex: 1,
                                        height: '36px',
                                        maxWidth: '200px'
                                    }}
                                />
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--color-gray-500)'
                                }}>
                                    {formatTime(recordingTime)}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Stop/Send button */}
                    {isRecording ? (
                        <button
                            className="btn btn-send"
                            onClick={stopRecording}
                            title="Detener grabación"
                            style={{ backgroundColor: 'var(--color-error)' }}
                        >
                            <Square className="w-5 h-5" fill="white" />
                        </button>
                    ) : (
                        <button
                            className="btn btn-send"
                            onClick={sendAudio}
                            disabled={isUploading}
                            title="Enviar audio"
                            style={{ backgroundColor: 'var(--color-primary-light)' }}
                        >
                            {isUploading ? '⏳' : <Send className="w-5 h-5" />}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', position: 'relative' }}>
            {/* Quick Reply Suggestions Popup - Moved here for better positioning context */}
            {showQuickReplies && (
                <div className="quick-reply-popup" style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '0',
                    width: '100%',
                    maxHeight: '300px',
                    backgroundColor: 'white',
                    borderTopLeftRadius: 'var(--radius-lg)',
                    borderTopRightRadius: 'var(--radius-lg)',
                    boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000,
                    overflowY: 'auto',
                    border: '1px solid var(--color-gray-200)',
                    marginBottom: '0'
                }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid var(--color-gray-100)', fontSize: '12px', fontWeight: 600, color: 'var(--color-gray-500)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>RESPUESTAS RÁPIDAS</span>
                        <button onClick={() => setShowQuickReplies(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X className="w-3 h-3" /></button>
                    </div>

                    {filteredReplies.length > 0 ? (
                        filteredReplies.map(reply => (
                            <div
                                key={reply.id}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '10px 16px',
                                    borderBottom: '1px solid var(--color-gray-50)',
                                    transition: 'background-color 0.2s',
                                    cursor: 'default' // Default cursor for container
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-gray-50)'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                {/* Main clickable area for selecting reply */}
                                <div
                                    onClick={() => handleQuickReplySelect(reply)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        flex: 1,
                                        cursor: 'pointer',
                                        minWidth: 0 // For text overflow
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '32px',
                                        height: '32px',
                                        backgroundColor: 'var(--color-primary-light)',
                                        borderRadius: '50%',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        fontSize: '14px',
                                        flexShrink: 0
                                    }}>
                                        /
                                    </div>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--color-gray-900)' }}>{reply.shortcut}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--color-gray-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {reply.content}
                                        </div>
                                    </div>
                                    {reply.media_url && <Image className="w-4 h-4 text-gray-400" />}
                                </div>

                                {/* Edit Button */}
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingQuickReply(reply);
                                            setShowQuickReplies(false);
                                            setShowQuickReplyManager(true);
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            padding: '6px',
                                            cursor: 'pointer',
                                            color: 'var(--color-gray-400)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '50%',
                                        }}
                                        title="Editar"
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--color-gray-200)';
                                            e.currentTarget.style.color = 'var(--color-primary)';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.color = 'var(--color-gray-400)';
                                        }}
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm('¿Eliminar esta respuesta rápida?')) {
                                                deleteQuickReply(reply.id);
                                            }
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            padding: '6px',
                                            cursor: 'pointer',
                                            color: 'var(--color-gray-400)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '50%',
                                        }}
                                        title="Eliminar"
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.backgroundColor = '#FEE2E2';
                                            e.currentTarget.style.color = '#EF4444';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.color = 'var(--color-gray-400)';
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-gray-500)', fontSize: '13px' }}>
                            No hay coincidencias para "{quickReplyFilter}"
                        </div>
                    )}

                    {/* Create new option */}
                    <button
                        onClick={() => {
                            setShowQuickReplies(false);
                            setShowQuickReplyManager(true);
                        }}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'var(--color-gray-50)',
                            color: 'var(--color-primary)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontWeight: 600,
                            borderTop: '1px solid var(--color-gray-200)'
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            border: '2px dashed var(--color-primary)',
                            color: 'var(--color-primary)'
                        }}>
                            <Plus className="w-4 h-4" />
                        </div>
                        Crear nueva respuesta rápida...
                    </button>
                </div>
            )}

            {/* File preview */}
            {selectedFile && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-4)',
                    backgroundColor: 'var(--color-gray-100)',
                    borderBottom: '1px solid var(--color-gray-200)'
                }}>
                    {filePreview ? (
                        <img
                            src={filePreview}
                            alt="Preview"
                            style={{
                                width: '60px',
                                height: '60px',
                                objectFit: 'cover',
                                borderRadius: 'var(--radius-md)'
                            }}
                        />
                    ) : (
                        <div style={{
                            width: '60px',
                            height: '60px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'var(--color-gray-200)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--color-gray-600)'
                        }}>
                            {getFileIcon(selectedFile.type)}
                        </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {selectedFile.name}
                        </p>
                        <p style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-gray-500)'
                        }}>
                            {formatFileSize(selectedFile.size)}
                        </p>
                    </div>
                    <button
                        onClick={clearFile}
                        className="btn btn-icon"
                        style={{ color: 'var(--color-error)' }}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Input area */}
            <div className="chat-input-container">
                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />

                {/* Attach button */}
                <button
                    className="btn btn-icon"
                    title="Adjuntar archivo"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled || isUploading}
                    style={{
                        flexShrink: 0,
                        backgroundColor: selectedFile ? 'var(--color-primary-light)' : 'transparent',
                        color: selectedFile ? 'var(--color-white)' : 'var(--color-gray-600)'
                    }}
                >
                    <Paperclip className="w-5 h-5" />
                </button>

                {/* Quick Reply Manager Modal */}
                {showQuickReplyManager && (
                    <QuickReplyManager
                        isOpen={showQuickReplyManager}
                        onClose={() => {
                            setShowQuickReplyManager(false);
                            setEditingQuickReply(null); // Clear editing state
                            fetchQuickReplies(); // Refresh list after closing
                        }}
                        initialContent={!editingQuickReply ? message.replace('/', '') : ''} // Setup initial content only if not editing
                        initialData={editingQuickReply}
                    />
                )}

                {/* Emoji button */}
                <div style={{ position: 'relative' }}>
                    <button
                        ref={emojiButtonRef}
                        className="btn btn-icon"
                        title="Emojis"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        disabled={disabled || isUploading}
                        style={{
                            flexShrink: 0,
                            color: showEmojiPicker ? 'var(--color-primary)' : 'var(--color-gray-600)'
                        }}
                    >
                        <Smile className="w-5 h-5" />
                    </button>

                    {showEmojiPicker && (
                        <div
                            ref={emojiPickerRef}
                            style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: 0,
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

                <textarea
                    className="message-input"
                    placeholder={selectedFile ? "Añade un mensaje (opcional)..." : "Escribe un mensaje..."}
                    value={message}
                    onChange={(e) => {
                        setMessage(e.target.value);
                        if (showEmojiPicker) setShowEmojiPicker(false);
                        // Auto-resize textarea
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                    disabled={disabled || isUploading}
                    rows={1}
                    style={{
                        fontSize: isMobile ? '16px' : '14px',
                        resize: 'none',
                        minHeight: '40px',
                        maxHeight: '120px',
                        overflowY: 'auto',
                        lineHeight: '1.4'
                    }}
                />

                {/* Mic button - hidden when typing */}
                {!message.trim() && !selectedFile && (
                    <button
                        className="btn btn-icon"
                        onClick={startRecording}
                        disabled={disabled || isUploading}
                        title="Grabar audio"
                        style={{
                            flexShrink: 0,
                            color: 'var(--color-gray-600)'
                        }}
                    >
                        <Mic className="w-5 h-5" />
                    </button>
                )}

                {/* Send button - always visible */}
                <button
                    className="btn btn-send"
                    onClick={handleSubmit}
                    disabled={(!message.trim() && !selectedFile) || disabled || isUploading}
                    title={selectedFile ? "Enviar archivo" : "Enviar mensaje"}
                    style={{
                        flexShrink: 0,
                        backgroundColor: (message.trim() || selectedFile)
                            ? 'var(--color-primary)'
                            : 'var(--color-gray-300)'
                    }}
                >
                    {isUploading ? '⏳' : <Send className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
};

export default MessageInput;
