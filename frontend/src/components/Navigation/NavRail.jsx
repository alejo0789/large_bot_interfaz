import React from 'react';
import { MessageSquare, Brain, Settings, X, LogOut, Send, LayoutDashboard } from 'lucide-react';

const NavRail = ({ activeTab, onTabChange, isMobile, isOpen, onClose, onOpen, onLogout, onBulkMessage }) => {
    const [isCollapsed, setIsCollapsed] = React.useState(true);

    // Mobile Drawer Style
    if (isMobile) {
        return (
            <>

                {/* Backdrop */}
                {isOpen && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            zIndex: 4900,
                            backdropFilter: 'blur(3px)',
                            WebkitBackdropFilter: 'blur(3px)'
                        }}
                        onClick={onClose}
                    />
                )}

                {/* Drawer */}
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        bottom: 0,
                        width: '300px',
                        zIndex: 5000,
                        backgroundColor: 'white',
                        display: isOpen ? 'flex' : 'none', // Changed from transform to display
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '15px 0 35px rgba(0,0,0,0.15)'
                    }}
                >
                    {/* Drawer Header - Clean & Compact */}
                    <div style={{
                        padding: '24px 20px',
                        background: 'var(--gradient-premium)',
                        color: 'white',
                        position: 'relative'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                borderRadius: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255,255,255,0.3)',
                                flexShrink: 0
                            }}>
                                <Brain style={{ color: 'white', width: '24px', height: '24px' }} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.025em' }}>
                                    Large Chat
                                </h2>
                                <p style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px', fontWeight: 500 }}>
                                    Panel de Control
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            style={{
                                position: 'absolute',
                                top: '15px',
                                right: '15px',
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                borderRadius: '8px',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                zIndex: 10
                            }}
                        >
                            <X className="w-4 h-4 text-white" />
                        </button>
                    </div>

                    <nav style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        flex: 1,
                        padding: '24px 12px',
                        overflowY: 'auto'
                    }}>
                        <div style={{ padding: '0 12px 12px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Navegación
                        </div>

                        <NavButton
                            icon={<MessageSquare />}
                            label="Chats"
                            active={activeTab === 'chat'}
                            onClick={() => { onTabChange('chat'); onClose(); }}
                            fullWidth
                        />
                        <NavButton
                            icon={<Brain />}
                            label="Cerebro IA"
                            active={activeTab === 'ai'}
                            onClick={() => { onTabChange('ai'); onClose(); }}
                            fullWidth
                        />
                        <NavButton
                            icon={<LayoutDashboard />}
                            label="Dashboard"
                            active={activeTab === 'dashboard'}
                            onClick={() => { onTabChange('dashboard'); onClose(); }}
                            fullWidth
                        />
                        <NavButton
                            icon={<Send />}
                            label="Envío Masivo"
                            active={false}
                            onClick={() => { onTabChange('bulk'); onClose(); }}
                            fullWidth
                        />

                        <div style={{ marginTop: '24px', padding: '0 12px 12px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Ajustes
                        </div>
                        <NavButton
                            icon={<Settings />}
                            label="Configuración"
                            active={activeTab === 'settings'}
                            onClick={() => { onTabChange('settings'); onClose(); }}
                            fullWidth
                        />
                    </nav>

                    {/* Drawer Footer */}
                    <div style={{
                        padding: '20px',
                        borderTop: '1px solid rgba(0,0,0,0.05)',
                        backgroundColor: 'rgba(0,0,0,0.02)'
                    }}>
                        <button
                            onClick={() => { onLogout(); onClose(); }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                width: '100%',
                                padding: '14px 16px',
                                borderRadius: '16px',
                                border: 'none',
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 6px rgba(185, 28, 28, 0.1)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                        >
                            <LogOut className="w-5 h-5" />
                            <span>Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            </>
        );
    }

    // Desktop Rail Style
    return (
        <div style={{
            width: isCollapsed ? '0px' : '72px',
            backgroundColor: 'white',
            borderRight: isCollapsed ? 'none' : '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '24px',
            gap: '16px',
            zIndex: 100,
            position: 'relative',
        }}>
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{
                    position: 'absolute',
                    top: '24px',
                    left: isCollapsed ? '0px' : '60px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 110,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    transition: 'all 0.3s ease',
                    color: '#6b7280',
                    padding: 0
                }}
            >
                <div style={{
                    transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                    display: 'flex'
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </div>
            </button>

            <div style={{
                opacity: isCollapsed ? 0 : 1,
                visibility: isCollapsed ? 'hidden' : 'visible',
                transition: 'opacity 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                width: '100%',
                height: '100%'
            }}>
                <NavButton
                    icon={<MessageSquare />}
                    label="Chat"
                    active={activeTab === 'chat'}
                    onClick={() => onTabChange('chat')}
                />
                <NavButton
                    icon={<Brain />}
                    label="IA"
                    active={activeTab === 'ai'}
                    onClick={() => onTabChange('ai')}
                />
                <NavButton
                    icon={<LayoutDashboard />}
                    label="Panel"
                    active={activeTab === 'dashboard'}
                    onClick={() => onTabChange('dashboard')}
                />
                <NavButton
                    icon={<Send />}
                    label="Masivos"
                    active={false}
                    onClick={() => onTabChange('bulk')}
                />

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                    <NavButton
                        icon={<Settings />}
                        label="Config"
                        active={activeTab === 'settings'}
                        onClick={() => onTabChange('settings')}
                    />
                    <NavButton
                        icon={<LogOut />}
                        label="Salir"
                        active={false}
                        onClick={onLogout}
                    />
                </div>
            </div>
        </div>
    );
};

const NavButton = ({ icon, label, active, onClick, fullWidth }) => (
    <button
        onClick={onClick}
        title={label}
        style={{
            display: 'flex',
            flexDirection: fullWidth ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: fullWidth ? 'flex-start' : 'center',
            gap: fullWidth ? 'var(--space-3)' : '4px',
            padding: fullWidth ? '12px 16px' : '10px 0',
            width: fullWidth ? '100%' : '56px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            backgroundColor: active ? 'var(--color-primary-light)' : 'transparent',
            color: active ? 'var(--color-primary-dark)' : 'var(--color-gray-500)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '0.75rem',
            fontWeight: 500
        }}
        onMouseEnter={(e) => {
            if (!active) {
                e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
                e.currentTarget.style.color = 'var(--color-gray-900)';
            }
        }}
        onMouseLeave={(e) => {
            if (!active) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-gray-500)';
            }
        }}
    >
        {React.cloneElement(icon, {
            className: fullWidth ? 'w-5 h-5' : 'w-6 h-6',
            strokeWidth: active ? 2.5 : 2
        })}
        {(!fullWidth || label) && <span>{label}</span>}
    </button>
);

export default NavRail;
