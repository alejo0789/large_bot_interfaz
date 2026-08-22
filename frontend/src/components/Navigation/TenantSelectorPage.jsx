import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useTenant } from '../../hooks/useTenant';
import { useAuth } from '../../hooks/useAuth';
import { MapPin, ArrowRight, LayoutGrid, LogOut, PlusCircle, Globe, Building2, Users } from 'lucide-react';
import CreateSedeModal from '../Admin/CreateSedeModal';
import AIArea from '../AI/AIArea';
import AdminPanel from '../Admin/AdminPanel';

const TenantSelectorPage = () => {
    const { tenants, selectTenant } = useTenant();
    const { user, logout } = useAuth();
    const [showSedeModal, setShowSedeModal] = useState(false);
    const [localTenants, setLocalTenants] = useState(null); // null = use context tenants
    const [activeView, setActiveView] = useState('sedes'); // 'sedes' | 'ai_global' | 'admin'

    const displayTenants = localTenants ?? tenants;
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    return (
        <div style={{
            minHeight: '100vh',
            width: '100vw',
            backgroundColor: '#f8fafc',
            display: 'flex',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            boxSizing: 'border-box',
            overflow: 'hidden'
        }}>
            {/* Sidebar Left */}
            <div style={{
                width: '270px',
                backgroundColor: '#0f172a',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                borderRight: '1px solid #1e293b',
                boxSizing: 'border-box'
            }}>
                {/* Brand Header */}
                <div style={{
                    padding: '24px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    borderBottom: '1px solid #1e293b'
                }}>
                    <div style={{
                        backgroundColor: '#11ab9c',
                        padding: '8px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <LayoutGrid color="white" size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: 'white', letterSpacing: '-0.02em' }}>
                            Panel <span style={{ color: '#11ab9c' }}>Sedes</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{user?.name || 'Super Admin'}</div>
                    </div>
                </div>

                {/* Navigation Links */}
                <div style={{ padding: '20px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ padding: '0 12px 8px 12px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Navegación
                    </div>

                    <button
                        onClick={() => setActiveView('sedes')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '11px 14px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: activeView === 'sedes' ? 'rgba(17,171,156,0.15)' : 'transparent',
                            color: activeView === 'sedes' ? '#11ab9c' : '#94a3b8',
                            fontWeight: activeView === 'sedes' ? 700 : 500,
                            fontSize: '14px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Building2 size={18} color={activeView === 'sedes' ? '#11ab9c' : '#94a3b8'} />
                        Mis Sedes
                    </button>

                    {isSuperAdmin && (
                        <button
                            onClick={() => setActiveView('ai_global')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '11px 14px',
                                borderRadius: '10px',
                                border: 'none',
                                backgroundColor: activeView === 'ai_global' ? 'rgba(37,99,235,0.2)' : 'transparent',
                                color: activeView === 'ai_global' ? '#60a5fa' : '#94a3b8',
                                fontWeight: activeView === 'ai_global' ? 700 : 500,
                                fontSize: '14px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Globe size={18} color={activeView === 'ai_global' ? '#60a5fa' : '#94a3b8'} />
                            IA Base General
                        </button>
                    )}

                    {isSuperAdmin && (
                        <button
                            onClick={() => setActiveView('admin')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '11px 14px',
                                borderRadius: '10px',
                                border: 'none',
                                backgroundColor: activeView === 'admin' ? 'rgba(147,51,234,0.2)' : 'transparent',
                                color: activeView === 'admin' ? '#c084fc' : '#94a3b8',
                                fontWeight: activeView === 'admin' ? 700 : 500,
                                fontSize: '14px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Users size={18} color={activeView === 'admin' ? '#c084fc' : '#94a3b8'} />
                            Gestión Usuarios
                        </button>
                    )}
                </div>

                {/* Logout Button Footer */}
                <div style={{ padding: '16px 12px', borderTop: '1px solid #1e293b' }}>
                    <button
                        onClick={logout}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: '1px solid #334155',
                            backgroundColor: 'transparent',
                            color: '#f87171',
                            fontWeight: '600',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <LogOut size={16} />
                        Cerrar Sesión
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {activeView === 'ai_global' ? (
                    <AIArea isMobile={false} user={user} isGlobalOnly={true} />
                ) : activeView === 'admin' ? (
                    <AdminPanel isMobile={false} />
                ) : (
                    /* Sedes View */
                    <div style={{ padding: '40px 36px', maxWidth: '1200px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
                        {/* Header Area */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '40px'
                        }}>
                            <div>
                                <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: '#1e293b' }}>
                                    Panel de Control <span style={{ color: '#11ab9c' }}>Sedes</span>
                                </h1>
                                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>Bienvenido, {user?.name}</p>
                            </div>
                        </div>

                        {/* Selection Text */}
                        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                            <h2 style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                                ¿A dónde vamos hoy?
                            </h2>
                            <p style={{ fontSize: '15px', color: '#64748b', maxWidth: '500px', margin: '0 auto' }}>
                                Selecciona una de tus sedes para gestionar conversaciones, configurar IA y visualizar reportes.
                            </p>
                        </div>

                        {/* Cards Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '24px',
                            width: '100%'
                        }}>
                            {displayTenants.map((tenant) => (
                                <div
                                    key={tenant.id}
                                    onClick={() => selectTenant(tenant)}
                                    style={{
                                        background: 'white',
                                        borderRadius: '24px',
                                        padding: '28px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '18px',
                                        border: '1px solid #e2e8f0',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'translateY(-6px)';
                                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                                        e.currentTarget.style.borderColor = '#11ab9c';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                    }}
                                >
                                    {/* Decorative background circle */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '-20px',
                                        right: '-20px',
                                        width: '120px',
                                        height: '120px',
                                        background: 'linear-gradient(135deg, rgba(17,171,156,0.1) 0%, rgba(17,171,156,0.05) 100%)',
                                        borderRadius: '50%',
                                        zIndex: 0
                                    }} />

                                    <div style={{
                                        width: '54px',
                                        height: '54px',
                                        borderRadius: '16px',
                                        backgroundColor: '#f1f5f9',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative',
                                        zIndex: 1
                                    }}>
                                        <MapPin size={28} color="#11ab9c" fill="rgba(17,171,156,0.2)" />
                                    </div>

                                    <div style={{ position: 'relative', zIndex: 1 }}>
                                        <h3 style={{ margin: '0 0 6px 0', fontSize: '19px', fontWeight: '800', color: '#1e293b' }}>
                                            {tenant.name}
                                        </h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            <span style={{
                                                padding: '3px 8px',
                                                backgroundColor: '#f1f5f9',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: '700',
                                                color: '#64748b',
                                                textTransform: 'uppercase'
                                            }}>
                                                {tenant.slug}
                                            </span>

                                            {tenant.slug?.includes('marketing') || tenant.is_connected === false ? (
                                                <span style={{
                                                    padding: '3px 8px',
                                                    backgroundColor: '#fee2e2',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    color: '#dc2626',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                                                    Desconectada
                                                </span>
                                            ) : (
                                                <span style={{
                                                    padding: '3px 8px',
                                                    backgroundColor: '#dcfce7',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    color: '#15803d',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                                                    Conectada
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{
                                        marginTop: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        position: 'relative',
                                        zIndex: 1
                                    }}>
                                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#11ab9c' }}>Entrar</span>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            backgroundColor: '#11ab9c',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <ArrowRight size={18} color="white" />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Card Nueva Sede — solo SUPER_ADMIN */}
                            {user?.role === 'SUPER_ADMIN' && (
                                <div
                                    onClick={() => setShowSedeModal(true)}
                                    style={{
                                        background: 'rgba(17,171,156,0.03)',
                                        borderRadius: '24px',
                                        padding: '28px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        border: '2px dashed #cbd5e1',
                                        transition: 'all 0.2s',
                                        color: '#64748b'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = '#11ab9c';
                                        e.currentTarget.style.color = '#11ab9c';
                                        e.currentTarget.style.backgroundColor = 'rgba(17,171,156,0.06)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = '#cbd5e1';
                                        e.currentTarget.style.color = '#64748b';
                                        e.currentTarget.style.backgroundColor = 'rgba(17,171,156,0.03)';
                                    }}
                                >
                                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <PlusCircle size={22} />
                                    </div>
                                    <span style={{ fontWeight: '700', fontSize: '15px' }}>Nueva Sede</span>
                                    <span style={{ fontSize: '12px', opacity: 0.7 }}>Registrar base de datos y configurar</span>
                                </div>
                            )}
                        </div>

                        {/* Footer Branding */}
                        <div style={{ marginTop: 'auto', paddingTop: '60px', paddingBottom: '30px', opacity: 0.5, textAlign: 'center' }}>
                            <span style={{ fontWeight: '800', letterSpacing: '2px' }}>LARGE<span style={{ color: '#11ab9c' }}>BOT</span></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Nueva Sede */}
            {showSedeModal && ReactDOM.createPortal(
                <CreateSedeModal
                    onClose={() => setShowSedeModal(false)}
                    onCreated={(newTenant) => {
                        setLocalTenants(prev => [...(prev ?? tenants), newTenant]);
                        setShowSedeModal(false);
                    }}
                    showToast={(msg) => alert(msg)}
                />,
                document.body
            )}
        </div>
    );
};

export default TenantSelectorPage;
