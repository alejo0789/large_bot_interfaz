import React, { useState, useEffect } from 'react';
import { X, Save, Settings, User, Lock, Mail, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

import apiFetch from '../../utils/api';

const SettingsModal = ({ isOpen, onClose }) => {
    const { user, token, login, updateProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('general');

    const [defaultAiEnabled, setDefaultAiEnabled] = useState(true);
    const [applyToExisting, setApplyToExisting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // Profile state
    const [profileName, setProfileName] = useState('');
    const [profileEmail, setProfileEmail] = useState('');
    const [profilePassword, setProfilePassword] = useState('');
    const [profileError, setProfileError] = useState('');

    // Load settings when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchSettings();
            if (user) {
                setProfileName(user.name || '');
                setProfileEmail(user.email || '');
                setProfilePassword('');
                setProfileError('');
            }
        }
    }, [isOpen, user]);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch('/api/settings');
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

    const handleSaveGeneral = async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch('/api/settings', {
                method: 'POST',
                body: JSON.stringify({
                    key: 'default_ai_enabled',
                    value: String(defaultAiEnabled),
                    applyToExisting: applyToExisting
                })
            });

            if (res.ok) {
                setSuccessMsg('Configuración IA guardada correctamente');
                setTimeout(() => setSuccessMsg(''), 3000);
            }
        } catch (error) {
            console.error('Error saving settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        setIsLoading(true);
        setProfileError('');
        try {
            const body = { name: profileName, email: profileEmail };
            if (profilePassword.trim()) {
                if (profilePassword.length < 6) {
                    setProfileError('La contraseña debe tener al menos 6 caracteres');
                    setIsLoading(false);
                    return;
                }
                body.password = profilePassword;
            }

            const res = await apiFetch('/api/auth/profile', {
                method: 'PUT',
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (res.ok) {
                setSuccessMsg('Perfil actualizado correctamente');
                setProfilePassword('');
                if (data.user) {
                    updateProfile(data.user);
                }
                setTimeout(() => setSuccessMsg(''), 3000);
            } else {
                setProfileError(data.error || 'Error al actualizar perfil');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            setProfileError('Error de conexión');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = () => {
        if (activeTab === 'general') handleSaveGeneral();
        else handleSaveProfile();
    };

    if (!isOpen) return null;



    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{
                maxWidth: '500px',
                width: '90%',
                padding: '0' // modal class provides border-radius and background
            }}>
                <div className="modal-header" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: 600 }}>
                            <Settings className="w-5 h-5" />
                            Ajustes
                        </h2>
                        <button className="btn btn-icon" onClick={onClose}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--color-gray-200)', marginTop: '8px' }}>
                        <button
                            onClick={() => setActiveTab('general')}
                            style={{
                                padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                                fontWeight: activeTab === 'general' ? 600 : 500,
                                color: activeTab === 'general' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                                borderBottom: activeTab === 'general' ? '2px solid var(--color-primary)' : '2px solid transparent'
                            }}
                        >
                            General
                        </button>
                        <button
                            onClick={() => setActiveTab('profile')}
                            style={{
                                padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                                fontWeight: activeTab === 'profile' ? 600 : 500,
                                color: activeTab === 'profile' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                                borderBottom: activeTab === 'profile' ? '2px solid var(--color-primary)' : '2px solid transparent'
                            }}
                        >
                            Mi Perfil
                        </button>
                    </div>
                </div>

                <div className="modal-body" style={{ padding: '20px' }}>
                    {activeTab === 'general' && (
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
                    )}

                    {activeTab === 'profile' && (
                        <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary-dark)', fontSize: '1.5rem', fontWeight: 600 }}>
                                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>@{user?.username}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>Gestiona tu información personal</div>
                                </div>
                            </div>

                            {profileError && (
                                <div style={{ padding: '10px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ShieldAlert size={16} /> {profileError}
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px', color: 'var(--color-gray-700)' }}>Nombre Completo</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-gray-400)' }} />
                                    <input
                                        type="text"
                                        value={profileName}
                                        onChange={e => setProfileName(e.target.value)}
                                        style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '6px', border: '1px solid var(--color-gray-300)', fontSize: '0.9rem' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px', color: 'var(--color-gray-700)' }}>Correo Electrónico</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-gray-400)' }} />
                                    <input
                                        type="email"
                                        value={profileEmail}
                                        onChange={e => setProfileEmail(e.target.value)}
                                        placeholder="No especificado"
                                        style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '6px', border: '1px solid var(--color-gray-300)', fontSize: '0.9rem' }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: '8px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px', color: 'var(--color-gray-700)' }}>Nueva Contraseña</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-gray-400)' }} />
                                    <input
                                        type="password"
                                        value={profilePassword}
                                        onChange={e => setProfilePassword(e.target.value)}
                                        placeholder="Dejar en blanco para no cambiar"
                                        style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '6px', border: '1px solid var(--color-gray-300)', fontSize: '0.9rem' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

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

                <div className="modal-footer" style={{ padding: '20px', borderTop: '1px solid var(--color-gray-200)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
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

            <style>{`
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
