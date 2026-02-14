import React, { useState } from 'react';
import { Image, Video, FileText } from 'lucide-react';
import ResourceManager from './ResourceManager';
import ContextManager from './ContextManager';

const AIArea = ({ isMobile }) => {
    const [activeSection, setActiveSection] = useState('images');

    // Definición de secciones y sus iconos
    const sections = [
        { id: 'images', label: 'Imágenes', icon: Image, description: 'Gestiona los recursos visuales para el asistente.' },
        { id: 'media', label: 'Audio/Video', icon: Video, description: 'Biblioteca de archivos multimedia para respuestas.' },
        { id: 'context', label: 'Contexto', icon: FileText, description: 'Documentación y contexto para entrenar a la IA.' },
    ];

    const currentSection = sections.find(s => s.id === activeSection) || sections[0];
    const isSmallScreen = isMobile || window.innerWidth < 768;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
            {/* Header / Tabs - Integrated Look */}
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
                    {activeSection === 'images' && <ResourceManager type="image" title="Galería de Imágenes" />}
                    {activeSection === 'media' && <ResourceManager type="media" title="Biblioteca Multimedia" />}
                    {activeSection === 'context' && <ContextManager />}
                </div>
            </div>
        </div>
    );
};

export default AIArea;
