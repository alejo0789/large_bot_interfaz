import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Save } from 'lucide-react';

const CreateTagModal = ({ isOpen, onClose, onCreateTag }) => {
    const [tagName, setTagName] = useState('');
    const [tagColor, setTagColor] = useState('#128C7E');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef(null);

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            setTagName('');
            setTagColor('#128C7E'); // Default color
            setTimeout(() => inputRef.current?.focus(), 80);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!tagName.trim()) return;

        setIsSubmitting(true);
        try {
            await onCreateTag(tagName.trim(), tagColor);
            onClose();
        } catch (error) {
            console.error('Error creating tag:', error);
            alert('Error al crear etiqueta');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Predefined colors for easy selection
    const presetColors = [
        '#128C7E', '#25D366', '#34B7F1', '#075E54', '#ECE5DD', // WhatsApp inspired
        '#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', // Standard UI colors
        '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#8B5A2B'
    ];

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999, // very high to appear over everything
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '380px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderBottom: '1px solid #f1f5f9',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '32px', height: '32px',
                            borderRadius: '10px',
                            background: `linear-gradient(135deg, ${tagColor} 0%, ${tagColor}80 100%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.3s ease'
                        }}>
                        </div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#111827' }}>
                            Crear Etiqueta
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#f3f4f6', border: 'none', borderRadius: '8px',
                            width: '32px', height: '32px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#6b7280', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#111827'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#6b7280'; }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} style={{ padding: '20px 16px' }}>

                    {/* Name input */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '8px' }}>
                            NOMBRE DE LA ETIQUETA
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={tagName}
                            onChange={e => setTagName(e.target.value)}
                            placeholder="Ej. VIP, Urgente, Soporte..."
                            disabled={isSubmitting}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                border: '1.5px solid #e5e7eb',
                                borderRadius: '10px',
                                fontSize: '14px',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s, box-shadow 0.2s',
                                outline: 'none'
                            }}
                            onFocus={e => {
                                e.target.style.borderColor = tagColor;
                                e.target.style.boxShadow = `0 0 0 3px ${tagColor}20`;
                            }}
                            onBlur={e => {
                                e.target.style.borderColor = '#e5e7eb';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    {/* Color picker */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>COLOR</span>
                            <span style={{ color: tagColor }}>{tagColor}</span>
                        </label>

                        {/* Custom Color Input Wrapper */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                overflow: 'hidden',
                                flexShrink: 0,
                                border: '2px solid #e5e7eb',
                                position: 'relative'
                            }}>
                                <input
                                    type="color"
                                    value={tagColor}
                                    onChange={e => setTagColor(e.target.value)}
                                    title="Elegir color personalizado"
                                    style={{
                                        position: 'absolute',
                                        top: '-10px', left: '-10px',
                                        width: '60px', height: '60px',
                                        cursor: 'pointer',
                                        border: 'none',
                                        padding: 0
                                    }}
                                />
                            </div>
                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                Color personalizado
                            </div>
                        </div>

                        {/* Presets Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, 1fr)',
                            gap: '8px'
                        }}>
                            {presetColors.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setTagColor(color)}
                                    style={{
                                        width: '100%',
                                        aspectRatio: '1/1',
                                        borderRadius: '8px',
                                        backgroundColor: color,
                                        border: tagColor === color ? '2px solid #111827' : '2px solid transparent',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0,
                                        transition: 'transform 0.1s'
                                    }}
                                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
                                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    {tagColor === color && <Check size={14} color="white" strokeWidth={3} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={!tagName.trim() || isSubmitting}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: tagName.trim() ? tagColor : '#e5e7eb',
                            color: tagName.trim() ? 'white' : '#9ca3af',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: tagName.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        {isSubmitting ? (
                            <div style={{
                                width: '16px', height: '16px',
                                border: '2px solid rgba(255,255,255,0.3)',
                                borderTopColor: 'white',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                        ) : (
                            <Save size={18} />
                        )}
                        {isSubmitting ? 'Creando...' : 'Guardar Etiqueta'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateTagModal;
