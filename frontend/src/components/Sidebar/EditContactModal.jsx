import React, { useState, useEffect } from 'react';
import { X, Save, User } from 'lucide-react';

const EditContactModal = ({ isOpen, onClose, initialName, onSave, contactPhone }) => {
    const [name, setName] = useState(initialName || '');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName(initialName || '');
            setError('');
        }
    }, [isOpen, initialName]);

    const handleSave = async () => {
        if (!name.trim()) {
            setError('El nombre no puede estar vacío');
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            await onSave(name);
            onClose();
        } catch (err) {
            console.error('Error saving name:', err);
            setError('Error al guardar el nombre');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{
                maxWidth: '400px',
                width: '90%',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                <div className="modal-header" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderBottom: '1px solid #e5e7eb',
                    backgroundColor: '#f9fafb'
                }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
                        <User className="w-5 h-5" />
                        Editar Contacto
                    </h3>
                    <button
                        onClick={onClose}
                        className="btn-icon-small"
                        title="Cerrar"
                        style={{ color: '#6b7280' }}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="modal-body" style={{ padding: '20px' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                            Nombre del contacto
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                                if (e.key === 'Escape') onClose();
                            }}
                            autoFocus
                            placeholder="Nombre..."
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'border-color 0.15s, box-shadow 0.15s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#075E54'}
                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        />
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '6px' }}>
                            Número: {contactPhone}
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            padding: '10px',
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            marginBottom: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <span>⚠️</span> {error}
                        </div>
                    )}
                </div>

                <div className="modal-footer" style={{
                    padding: '16px',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    backgroundColor: '#f9fafb'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: 'white',
                            color: '#374151',
                            cursor: 'pointer',
                            fontWeight: 500,
                            fontSize: '0.875rem'
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#075E54', // var(--color-primary)
                            color: 'white',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            fontWeight: 500,
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: isLoading ? 0.7 : 1,
                            minWidth: '100px',
                            justifyContent: 'center'
                        }}
                    >
                        {isLoading ? (
                            'Guardando...'
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Guardar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditContactModal;
