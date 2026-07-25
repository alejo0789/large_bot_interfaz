import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Settings, User, Lock, Mail, ShieldAlert, QrCode, Wifi, WifiOff, CheckCircle2, RotateCw, RefreshCw, MessageSquare } from 'lucide-react';
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

    // WhatsApp connection state
    const [waLoading, setWaLoading] = useState(false);
    const [waQrLoading, setWaQrLoading] = useState(false);
    const [waStatus, setWaStatus] = useState(null); // { connected, state, instanceName, provider, error? }
    const [waQr, setWaQr] = useState(null); // base64 string
    const [waRestarting, setWaRestarting] = useState(false);
    const waPollRef = useRef(null);

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
        } else {
            // Stop WhatsApp polling when modal closes
            if (waPollRef.current) {
                clearInterval(waPollRef.current);
                waPollRef.current = null;
            }
        }
    }, [isOpen, user]);

    // Polling WhatsApp status when on 'whatsapp' tab
    useEffect(() => {
        if (isOpen && activeTab === 'whatsapp') {
            checkWhatsAppStatus(true);
            waPollRef.current = setInterval(() => {
                checkWhatsAppStatus(false);
            }, 5000);
        } else {
            if (waPollRef.current) {
                clearInterval(waPollRef.current);
                waPollRef.current = null;
            }
        }
        return () => {
            if (waPollRef.current) {
                clearInterval(waPollRef.current);
                waPollRef.current = null;
            }
        };
    }, [isOpen, activeTab]);

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

    const checkWhatsAppStatus = async (showLoading = false) => {
        if (showLoading) setWaLoading(true);
        try {
            const res = await apiFetch('/api/settings/whatsapp-status');
            const data = await res.json();
            if (res.ok && data.success) {
                setWaStatus(data);
                if (data.connected) {
                    setWaQr(null);
                    if (waPollRef.current) {
                        clearInterval(waPollRef.current);
                        waPollRef.current = null;
                    }
                } else if (!data.connected && data.provider === 'evolution' && data.state !== 'no_instance' && !waQr && !waQrLoading) {
                    fetchWhatsAppQR();
                }
            } else {
                setWaStatus({ connected: false, error: data.error || 'Error al obtener estado' });
            }
        } catch (err) {
            console.error('Error checking whatsapp status:', err);
            setWaStatus({ connected: false, error: 'Error de conexión con el servidor' });
        } finally {
            if (showLoading) setWaLoading(false);
        }
    };

    const fetchWhatsAppQR = async () => {
        setWaQrLoading(true);
        try {
            const res = await apiFetch('/api/settings/whatsapp-qr');
            const data = await res.json();
            if (res.ok && data.success) {
                if (data.connected) {
                    setWaStatus(prev => ({ ...prev, connected: true, state: 'open' }));
                    setWaQr(null);
                } else {
                    setWaQr(data.qr || null);
                }
            }
        } catch (err) {
            console.error('Error fetching QR:', err);
        } finally {
            setWaQrLoading(false);
        }
    };

    const handleRestartWhatsApp = async () => {
        setWaRestarting(true);
        try {
            const res = await apiFetch('/api/settings/whatsapp-restart', { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.success) {
                setSuccessMsg('Instancia reiniciada correctamente. Obteniendo nuevo QR...');
                setTimeout(() => {
                    setSuccessMsg('');
                    fetchWhatsAppQR();
                    checkWhatsAppStatus(true);
                }, 2000);
            } else {
                setProfileError(data.error || 'Error al reiniciar la instancia');
            }
        } catch (err) {
            console.error('Error restarting instance:', err);
        } finally {
            setWaRestarting(false);
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
        else if (activeTab === 'profile') handleSaveProfile();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{
                maxWidth: '520px',
                width: '90%',
                padding: '0'
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
                    <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--color-gray-200)', marginTop: '8px', overflowX: 'auto' }}>
                        <button
                            onClick={() => setActiveTab('general')}
                            style={{
                                padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                                fontWeight: activeTab === 'general' ? 600 : 500,
                                color: activeTab === 'general' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                                borderBottom: activeTab === 'general' ? '2px solid var(--color-primary)' : '2px solid transparent',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            General
                        </button>
                        <button
                            onClick={() => setActiveTab('whatsapp')}
                            style={{
                                padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                                fontWeight: activeTab === 'whatsapp' ? 600 : 500,
                                color: activeTab === 'whatsapp' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                                borderBottom: activeTab === 'whatsapp' ? '2px solid var(--color-primary)' : '2px solid transparent',
                                display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap'
                            }}
                        >
                            <MessageSquare className="w-4 h-4" />
                            Conexión WhatsApp
                        </button>
                        <button
                            onClick={() => setActiveTab('profile')}
                            style={{
                                padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                                fontWeight: activeTab === 'profile' ? 600 : 500,
                                color: activeTab === 'profile' ? 'var(--color-primary)' : 'var(--color-gray-500)',
                                borderBottom: activeTab === 'profile' ? '2px solid var(--color-primary)' : '2px solid transparent',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Mi Perfil
                        </button>
                    </div>
                </div>

                <div className="modal-body" style={{ padding: '20px', maxHeight: '75vh', overflowY: 'auto' }}>
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

                    {activeTab === 'whatsapp' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                    <MessageSquare className="w-5 h-5 text-primary" />
                                    Estado de WhatsApp de la Sede
                                </h3>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => { checkWhatsAppStatus(true); fetchWhatsAppQR(); }}
                                    disabled={waLoading || waQrLoading}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px' }}
                                >
                                    <RotateCw className={`w-3.5 h-3.5 ${(waLoading || waQrLoading) ? 'animate-spin' : ''}`} />
                                    Verificar
                                </button>
                            </div>

                            {waLoading && !waStatus && (
                                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-gray-500)' }}>
                                    <RotateCw className="w-6 h-6 animate-spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                                    Verificando estado de WhatsApp...
                                </div>
                            )}

                            {waStatus && waStatus.provider === 'official' && (
                                <div style={{
                                    padding: '16px',
                                    backgroundColor: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '12px'
                                }}>
                                    <CheckCircle2 size={24} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#15803d', fontSize: '0.95rem' }}>WhatsApp Oficial Activo</div>
                                        <div style={{ fontSize: '0.85rem', color: '#166534', marginTop: '4px' }}>
                                            Esta sede está configurada con la API Oficial de Meta (Cloud API). No requiere código QR ni sincronización con dispositivo móvil.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {waStatus && waStatus.provider === 'evolution' && waStatus.state === 'no_instance' && (
                                <div style={{
                                    padding: '16px',
                                    backgroundColor: '#fffbe6',
                                    border: '1px solid #ffe58f',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '12px'
                                }}>
                                    <ShieldAlert size={24} color="#d48806" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#d48806', fontSize: '0.95rem' }}>Instancia no configurada</div>
                                        <div style={{ fontSize: '0.85rem', color: '#8c6b00', marginTop: '4px' }}>
                                            Esta sede no tiene asignada una instancia de Evolution API. Por favor, solicita a un administrador que configure la instancia de Evolution para esta sede.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {waStatus && waStatus.provider === 'evolution' && waStatus.connected && (
                                <div style={{
                                    padding: '20px',
                                    backgroundColor: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '12px',
                                    textAlign: 'center',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <CheckCircle2 size={32} color="#16a34a" />
                                    </div>
                                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#15803d' }}>
                                        WhatsApp Conectado
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#166534', maxWidth: '360px' }}>
                                        La sede se encuentra vinculada y lista para recibir y enviar mensajes en tiempo real.
                                    </p>
                                    <div style={{ fontSize: '0.8rem', backgroundColor: '#ffffff', padding: '4px 12px', borderRadius: '20px', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 500, marginTop: '4px' }}>
                                        Instancia: <code>{waStatus.instanceName}</code>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => fetchWhatsAppQR()}
                                            style={{ fontSize: '0.8rem' }}
                                        >
                                            Solicitar QR de reconexión
                                        </button>
                                    </div>
                                </div>
                            )}

                            {waStatus && waStatus.provider === 'evolution' && !waStatus.connected && waStatus.state !== 'no_instance' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{
                                        padding: '14px',
                                        backgroundColor: '#fff1f2',
                                        border: '1px solid #fecdd3',
                                        borderRadius: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}>
                                        <WifiOff size={24} color="#e11d48" style={{ flexShrink: 0 }} />
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#be123c', fontSize: '0.95rem' }}>
                                                WhatsApp Desconectado
                                            </div>
                                            <div style={{ fontSize: '0.82rem', color: '#9f1239' }}>
                                                La línea se ha desconectado. Escanea el código QR a continuación para volver a conectar.
                                            </div>
                                        </div>
                                    </div>

                                    {/* QR Display Container */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        padding: '20px',
                                        backgroundColor: 'var(--color-gray-50)',
                                        border: '1px solid var(--color-gray-200)',
                                        borderRadius: '12px',
                                        textAlign: 'center'
                                    }}>
                                        {waQrLoading ? (
                                            <div style={{ padding: '40px 0' }}>
                                                <RotateCw className="w-8 h-8 animate-spin text-primary" style={{ margin: '0 auto 12px auto', display: 'block' }} />
                                                <div style={{ fontSize: '0.9rem', color: 'var(--color-gray-600)', fontWeight: 500 }}>Generando Código QR de Evolution...</div>
                                            </div>
                                        ) : waQr ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    padding: '12px',
                                                    backgroundColor: '#ffffff',
                                                    borderRadius: '12px',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                                    border: '1px solid var(--color-gray-200)'
                                                }}>
                                                    <img src={waQr} alt="Código QR WhatsApp" style={{ width: '220px', height: '220px', display: 'block', borderRadius: '4px' }} />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }}></span>
                                                    Buscando vinculación en tiempo real (escanea con tu móvil)...
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <QrCode size={48} color="#94a3b8" />
                                                <div style={{ fontSize: '0.9rem', color: 'var(--color-gray-600)' }}>Haz clic en el botón para solicitar un nuevo código QR</div>
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={fetchWhatsAppQR}
                                                    style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                >
                                                    <QrCode size={16} /> Obtener Código QR
                                                </button>
                                            </div>
                                        )}

                                        {/* Step-by-step scanning instructions */}
                                        <div style={{
                                            marginTop: '16px',
                                            padding: '12px 16px',
                                            backgroundColor: '#ffffff',
                                            borderRadius: '8px',
                                            border: '1px solid var(--color-gray-200)',
                                            textAlign: 'left',
                                            width: '100%',
                                            fontSize: '0.82rem',
                                            color: 'var(--color-gray-700)'
                                        }}>
                                            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--color-gray-900)' }}>Instrucciones para escanear:</div>
                                            <ol style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <li>Abre <b>WhatsApp</b> en el teléfono móvil de la sede.</li>
                                                <li>Ve a <b>Menú (⋮) / Configuración</b> &gt; <b>Dispositivos vinculados</b>.</li>
                                                <li>Toca en <b>Vincular un dispositivo</b> y apunta con la cámara al código QR.</li>
                                            </ol>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={fetchWhatsAppQR}
                                                disabled={waQrLoading}
                                                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                <RefreshCw size={14} /> Refrescar QR
                                            </button>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={handleRestartWhatsApp}
                                                disabled={waRestarting}
                                                style={{ fontSize: '0.8rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                                            >
                                                {waRestarting ? 'Reiniciando...' : 'Reiniciar Instancia'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
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
                    {activeTab !== 'whatsapp' && (
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={isLoading}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Save className="w-4 h-4" />
                            {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    )}
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
        </div>
    );
};

export default SettingsModal;
