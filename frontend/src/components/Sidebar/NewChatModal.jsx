import React, { useState } from 'react';
import { X, UserPlus, Phone, Loader } from 'lucide-react';

const NewChatModal = ({ isOpen, onClose, onStartChat }) => {
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Basic validation
        const cleanPhone = phone.replace(/\D/g, '');
        if (!cleanPhone || cleanPhone.length < 7) {
            setError('Ingresa un número válido (mínimo 7 dígitos)');
            return;
        }

        setIsLoading(true);

        try {
            await onStartChat(cleanPhone); // Send clean phone
            setPhone('');
            // Parent handles closing on success usually, but we can do it here if parent resolves
            // However, parent might throw error, so we catch it.
        } catch (err) {
            console.error(err);
            if (err.message && err.message.includes('404')) {
                setError('El número no tiene WhatsApp.');
            } else {
                setError(err.message || 'Error al verificar el número. Intenta de nuevo.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserPlus className="w-5 h-5" />
                        Nuevo Contacto
                    </h3>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <p style={{ fontSize: '14px', color: 'var(--color-gray-600)', marginBottom: '16px' }}>
                        Ingresa el número de teléfono (con código de país) para iniciar una nueva conversación. Se verificará si tiene WhatsApp.
                    </p>

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-gray-700)' }}>
                                Número de Teléfono
                            </label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Phone className="w-4 h-4" style={{ position: 'absolute', left: '12px', color: 'var(--color-gray-400)' }} />
                                <input
                                    type="tel"
                                    className="search-input"
                                    value={phone}
                                    onChange={(e) => {
                                        setPhone(e.target.value);
                                        setError('');
                                    }}
                                    placeholder="Ej: 573155555555"
                                    maxLength={20}
                                    autoFocus
                                    style={{
                                        paddingLeft: '36px',
                                        width: '100%',
                                        height: '42px',
                                        fontSize: '15px'
                                    }}
                                />
                            </div>
                            {error && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    color: 'var(--color-error)',
                                    fontSize: '12px',
                                    marginTop: '8px',
                                    backgroundColor: '#FEF2F2',
                                    padding: '8px',
                                    borderRadius: '6px'
                                }}>
                                    <span style={{ fontWeight: 'bold' }}>⚠️</span>
                                    {error}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                type="button"
                                className="btn"
                                onClick={onClose}
                                style={{ backgroundColor: 'var(--color-gray-100)', color: 'var(--color-gray-700)' }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={isLoading || !phone}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    minWidth: '100px',
                                    justifyContent: 'center'
                                }}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader className="w-4 h-4 animate-spin" />
                                        Verificando...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="w-4 h-4" />
                                        Iniciar Chat
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default NewChatModal;
