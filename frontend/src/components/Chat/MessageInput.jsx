import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X, Image, FileText, Film, Mic, Square, Trash2, Smile } from 'lucide-react';

/**
 * Message input component with file attachment and voice recording
 */
const MessageInput = ({ onSend, onSendFile, disabled, isMobile }) => {
    const [message, setMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [audioWaveform, setAudioWaveform] = useState([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Common emojis
    const commonEmojis = [
        '😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎',
        '🤔', '😅', '😢', '😭', '😡', '🥺', '😱', '🤯',
        '👍', '👎', '👏', '🙏', '💪', '🤝', '✌️', '👋',
        '❤️', '💕', '💯', '🔥', '⭐', '✨', '🎉', '🎊',
        '✅', '❌', '⚠️', '📌', '📎', '💼', '📱', '💻'
    ];

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
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Create audio context for visualization
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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

            // Create media recorder
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(audioBlob);
                setAudioUrl(URL.createObjectURL(audioBlob));
                stream.getTracks().forEach(track => track.stop());
                audioContext.close();
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('No se pudo acceder al micrófono. Verifica los permisos.');
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
            // Create a file from the blob
            const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
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
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
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
        <div style={{ width: '100%' }}>
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

                {/* Emoji button */}
                <div style={{ position: 'relative' }}>
                    <button
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

                    {/* Emoji picker popup */}
                    {showEmojiPicker && (
                        <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: 0,
                            marginBottom: '8px',
                            backgroundColor: 'var(--color-white)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-lg)',
                            padding: 'var(--space-2)',
                            width: '280px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 100
                        }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(8, 1fr)',
                                gap: '4px'
                            }}>
                                {commonEmojis.map((emoji, index) => (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            setMessage(prev => prev + emoji);
                                            setShowEmojiPicker(false);
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            fontSize: '20px',
                                            padding: '4px',
                                            cursor: 'pointer',
                                            borderRadius: 'var(--radius-sm)',
                                            transition: 'background-color 0.15s'
                                        }}
                                        onMouseOver={(e) => e.target.style.backgroundColor = 'var(--color-gray-100)'}
                                        onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <textarea
                    className="message-input"
                    placeholder={selectedFile ? "Añade un mensaje (opcional)..." : "Escribe un mensaje..."}
                    value={message}
                    onChange={(e) => {
                        setMessage(e.target.value);
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
