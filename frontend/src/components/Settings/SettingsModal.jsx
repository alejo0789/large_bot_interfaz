import React, { useState, useEffect } from 'react';
import { X, Save, Settings } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const SettingsModal = ({ isOpen, onClose }) => {
    const [defaultAiEnabled, setDefaultAiEnabled] = useState(true);
    const [applyToExisting, setApplyToExisting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // Load settings when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchSettings();
        }
    }, [isOpen]);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/settings`);
            if (res.ok) {
                const data = await res.json();
                if (data.settings && data.settings.default_ai_enabled !== undefined) {
                    setDefaultAiEnabled(String(data.settings.default_ai_enabled) === 'true');
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'default_ai_enabled',
                    value: String(defaultAiEnabled),
                    applyToExisting: applyToExisting
                })
            });

            if (res.ok) {
                setSuccessMsg('Configuración guardada correctamente');
                setTimeout(() => setSuccessMsg(''), 3000);
            }
        } catch (error) {
            console.error('Error saving settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const overlayStyle = {
        position: 'fixed',
        inset: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.75)', // Darker background
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999, // Very high z-index
        backdropFilter: 'blur(4px)' // Add blur effect
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={overlayStyle}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{
                maxWidth: '500px',
                backgroundColor: 'white',
                borderRadius: '12px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                position: 'relative',
                zIndex: 10000,
                width: '90%'
            }}>
                <div className="modal-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Settings className="w-5 h-5" />
                        Configuración Global
                    </h2>
                    <button className="btn btn-icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="modal-body">
                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px' }}>
                            Inteligencia Artificial (IA)
                        </h3>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px',
                            backgroundColor: 'var(--color-gray-50)',
                            borderRadius: '8px',
                            border: '1px solid var(--color-gray-200)'
                        }}>
                            <div>
                                <div style={{ fontWeight: 500 }}>IA Activada por defecto</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>
                                    Activar IA automáticamente para nuevas conversaciones
                                </div>
                            </div>

                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={defaultAiEnabled}
                                    onChange={(e) => setDefaultAiEnabled(e.target.checked)}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>


                        <div style={{ marginTop: '12px', paddingLeft: '4px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--color-gray-700)', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={applyToExisting}
                                    onChange={(e) => setApplyToExisting(e.target.checked)}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                                Aplicar también a todas las conversaciones existentes
                            </label>
                        </div>
                    </div>

                    {successMsg && (
                        <div style={{
                            padding: '10px',
                            marginBottom: '10px',
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            borderRadius: '6px',
                            fontSize: '0.9rem',
                            textAlign: 'center'
                        }}>
                            {successMsg}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Cerrar
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={isLoading}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Save className="w-4 h-4" />
                        {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            <style jsx>{`
                /* Toggle Switch Styles */
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 50px;
                    height: 24px;
                }
                .switch input { 
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    -webkit-transition: .4s;
                    transition: .4s;
                }
                .slider:before {
                    position: absolute;
                    content: "";
                    height: 16px;
                    width: 16px;
                    left: 4px;
                    bottom: 4px;
                    background-color: white;
                    -webkit-transition: .4s;
                    transition: .4s;
                }
                input:checked + .slider {
                    background-color: var(--color-primary);
                }
                input:focus + .slider {
                    box-shadow: 0 0 1px var(--color-primary);
                }
                input:checked + .slider:before {
                    -webkit-transform: translateX(26px);
                    -ms-transform: translateX(26px);
                    transform: translateX(26px);
                }
                .slider.round {
                    border-radius: 34px;
                }
                .slider.round:before {
                    border-radius: 50%;
                }
            `}</style>
        </div >
    );
};

export default SettingsModal;
