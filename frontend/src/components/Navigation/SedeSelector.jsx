import React from 'react';
import { useTenant } from '../../hooks/useTenant';
import { useAuth } from '../../hooks/useAuth';
import { MapPin, ChevronDown, Check, LayoutGrid } from 'lucide-react';

const SedeSelector = ({ isCollapsed = false }) => {
    const { currentTenant, selectTenant, tenants } = useTenant();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = React.useState(false);

    // If user only has 1 tenant and isn't SUPER_ADMIN, don't show selector unless they want to see it
    if (tenants.length <= 1 && user?.role !== 'SUPER_ADMIN') {
        return null;
    }

    return (
        <div style={{ position: 'relative', width: '100%', padding: isCollapsed ? '0 8px' : '0 12px' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                    width: '100%',
                    padding: '10px 12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#334155',
                    transition: 'all 0.2s ease',
                    overflow: 'hidden'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={18} color="#4f46e5" />
                    {!isCollapsed && (
                        <span style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '120px'
                        }}>
                            {currentTenant?.name || 'Seleccionar Sede'}
                        </span>
                    )}
                </div>
                {!isCollapsed && <ChevronDown size={16} color="#64748b" />}
            </button>

            {isOpen && (
                <>
                    <div
                        onClick={() => setIsOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
                    />
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: isCollapsed ? '72px' : '12px',
                        marginTop: '8px',
                        width: '220px',
                        background: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        border: '1px solid #e2e8f0',
                        zIndex: 1001,
                        overflow: 'hidden',
                        padding: '4px'
                    }}>
                        <div style={{ padding: '8px 12px', fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Mis Sedes
                        </div>
                        {tenants.map((tenant) => (
                            <button
                                key={tenant.id}
                                onClick={() => {
                                    selectTenant(tenant);
                                    setIsOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: currentTenant?.slug === tenant.slug ? '#f1f5f9' : 'transparent',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: currentTenant?.slug === tenant.slug ? '#1e293b' : '#64748b',
                                    textAlign: 'left',
                                    transition: 'all 0.1s ease',
                                }}
                                onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
                                onMouseLeave={(e) => e.target.style.background = currentTenant?.slug === tenant.slug ? '#f1f5f9' : 'transparent'}
                            >
                                <span style={{ fontWeight: currentTenant?.slug === tenant.slug ? '600' : '400' }}>
                                    {tenant.name}
                                </span>
                                {currentTenant?.slug === tenant.slug && <Check size={16} color="#10b981" />}
                            </button>
                        ))}

                        {user?.role === 'SUPER_ADMIN' && (
                            <>
                                <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 8px' }} />
                                <button
                                    onClick={() => {
                                        localStorage.removeItem('current_tenant');
                                        window.location.reload();
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        color: '#11ab9c',
                                        fontWeight: '700',
                                        textAlign: 'left',
                                        transition: 'all 0.1s ease',
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = '#f0fdfa'}
                                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                >
                                    <LayoutGrid size={16} />
                                    Panel de Sedes
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default SedeSelector;
