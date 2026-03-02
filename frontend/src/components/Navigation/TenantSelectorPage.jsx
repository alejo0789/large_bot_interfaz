import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useTenant } from '../../hooks/useTenant';
import { useAuth } from '../../hooks/useAuth';
import { MapPin, ArrowRight, LayoutGrid, LogOut, PlusCircle } from 'lucide-react';
import CreateSedeModal from '../Admin/CreateSedeModal';

const TenantSelectorPage = () => {
    const { tenants, selectTenant, refreshTenants } = useTenant();
    const { user, logout } = useAuth();
    const [showSedeModal, setShowSedeModal] = useState(false);
    const [localTenants, setLocalTenants] = useState(null); // null = use context tenants

    const displayTenants = localTenants ?? tenants;

    return (
        <div style={{
            minHeight: '100vh',
            width: '100%',
            backgroundColor: '#f1f5f9',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '40px 20px',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            overflowY: 'auto',
            boxSizing: 'border-box'
        }}>
            {/* Header Area */}
            <div style={{
                maxWidth: '1200px',
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '60px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        backgroundColor: '#11ab9c',
                        padding: '10px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <LayoutGrid color="white" size={24} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#1e293b' }}>
                            Panel de Control <span style={{ color: '#11ab9c' }}>Sedes</span>
                        </h1>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Bienvenido, {user?.name}</p>
                    </div>
                </div>

                <button
                    onClick={logout}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        background: 'white',
                        color: '#ef4444',
                        fontWeight: '600',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fff1f2'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                    <LogOut size={18} />
                    Cerrar Sesión
                </button>
            </div>

            {/* Selection Text */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', marginBottom: '12px' }}>
                    ¿A dónde vamos hoy?
                </h2>
                <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '500px' }}>
                    Selecciona una de tus sedes para gestionar conversaciones, configurar IA y visualizar reportes.
                </p>
            </div>

            {/* Cards Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '24px',
                maxWidth: '1200px',
                width: '100%'
            }}>
                {tenants.map((tenant) => (
                    <div
                        key={tenant.id}
                        onClick={() => selectTenant(tenant)}
                        style={{
                            background: 'white',
                            borderRadius: '24px',
                            padding: '32px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '20px',
                            border: '1px solid #e2e8f0',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-8px)';
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                            e.currentTarget.style.borderColor = '#11ab9c';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
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
                            width: '60px',
                            height: '60px',
                            borderRadius: '16px',
                            backgroundColor: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            <MapPin size={32} color="#11ab9c" fill="rgba(17,171,156,0.2)" />
                        </div>

                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>
                                {tenant.name}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                    padding: '4px 10px',
                                    backgroundColor: '#f1f5f9',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    color: '#64748b',
                                    textTransform: 'uppercase'
                                }}>
                                    {tenant.slug}
                                </span>
                            </div>
                        </div>

                        <div style={{
                            marginTop: '12px',
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
                            padding: '32px',
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
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <PlusCircle size={24} />
                        </div>
                        <span style={{ fontWeight: '700', fontSize: '15px' }}>Nueva Sede</span>
                        <span style={{ fontSize: '12px', opacity: 0.7 }}>Registrar base de datos y configurar</span>
                    </div>
                )}
            </div>

            {/* Footer Branding */}
            <div style={{ marginTop: 'auto', paddingTop: '60px', opacity: 0.5 }}>
                <span style={{ fontWeight: '800', letterSpacing: '2px' }}>LARGE<span style={{ color: '#11ab9c' }}>BOT</span></span>
            </div>
            {/* Modal Nueva Sede — portal para saltar overflow containers */}
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
