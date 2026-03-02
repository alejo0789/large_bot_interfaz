import React, { useState } from 'react';
import { ShoppingBag, Megaphone, Wrench, FileText } from 'lucide-react';
import ProductosManager from './ProductosManager';
import PromocionesManager from './PromocionesManager';
import ServiciosManager from './ServiciosManager';

const AIArea = ({ isMobile }) => {
    const [activeSection, setActiveSection] = useState('productos');

    const sections = [
        {
            id: 'productos',
            label: 'Productos',
            icon: ShoppingBag,
            description: 'Catálogo de productos con precios e información detallada para la IA.'
        },
        {
            id: 'promociones',
            label: 'Promociones',
            icon: Megaphone,
            description: 'Gestiona promociones activas e inactivas que la IA puede comunicar.'
        },
        {
            id: 'servicios',
            label: 'Servicios',
            icon: Wrench,
            description: 'Catálogo de servicios ofrecidos con descripción, precio e imagen.'
        },
    ];

    const currentSection = sections.find(s => s.id === activeSection) || sections[0];
    const isSmallScreen = isMobile || window.innerWidth < 768;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
            {/* Header / Tabs */}
            <div style={{
                padding: isSmallScreen ? '20px 20px 0 20px' : '32px 32px 0 32px',
                backgroundColor: 'white',
                borderBottom: '1px solid #e5e7eb',
                flexShrink: 0
            }}>
                <div style={{ marginBottom: isSmallScreen ? '16px' : '24px' }}>
                    <h2 style={{ fontSize: isSmallScreen ? '1.4rem' : '1.75rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                        Base de Conocimiento
                    </h2>
                    <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '0.85rem' }}>
                        {currentSection.description}
                    </p>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '4px',
                    backgroundColor: '#f3f4f6',
                    padding: '4px',
                    borderRadius: '12px',
                    width: 'fit-content',
                    marginBottom: isSmallScreen ? '16px' : '24px',
                    overflowX: 'auto',
                    maxWidth: '100%',
                    WebkitOverflowScrolling: 'touch'
                }}>
                    {sections.map(section => {
                        const Icon = section.icon;
                        const isActive = activeSection === section.id;
                        return (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: isSmallScreen ? '8px 12px' : '10px 20px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    backgroundColor: isActive ? 'white' : 'transparent',
                                    color: isActive ? 'var(--color-primary)' : '#6b7280',
                                    fontWeight: isActive ? 700 : 500,
                                    fontSize: isSmallScreen ? '0.8rem' : '0.9rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    outline: 'none',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{section.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, padding: isSmallScreen ? '16px' : '32px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{
                    maxWidth: '1200px',
                    margin: '0 auto',
                    backgroundColor: 'white',
                    borderRadius: isSmallScreen ? '16px' : '24px',
                    padding: isSmallScreen ? '16px' : '32px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                    border: '1px solid #e5e7eb',
                    minHeight: '100%',
                    width: '100%',
                    boxSizing: 'border-box'
                }}>
                    {activeSection === 'productos' && <ProductosManager />}
                    {activeSection === 'promociones' && <PromocionesManager />}
                    {activeSection === 'servicios' && <ServiciosManager />}
                </div>
            </div>
        </div>
    );
};

export default AIArea;
