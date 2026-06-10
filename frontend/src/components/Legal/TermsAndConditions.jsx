import React, { useState, useMemo } from 'react';
import { 
    FileText, Shield, UserCheck, MessageCircle, Scale, 
    HelpCircle, ArrowLeft, Printer, Search, Check, 
    BookOpen, AlertCircle, PhoneCall, RefreshCw
} from 'lucide-react';

const SECTIONS = [
    {
        id: 'acceptance',
        title: '1. Aceptación de los Términos',
        icon: UserCheck,
        content: `Al acceder y utilizar nuestra plataforma de chatbot multi-canal ("la Plataforma"), usted acepta estar sujeto a estos Términos y Condiciones de Uso, así como a todas las leyes y regulaciones aplicables. Si no está de acuerdo con alguno de estos términos, tiene prohibido utilizar o acceder a este sitio y a nuestros servicios.

Los servicios ofrecidos están dirigidos a personas jurídicas o personas naturales mayores de edad con capacidad legal para contratar. Al registrarse, garantiza que todos los datos de registro proporcionados son verídicos, exactos y actualizados.`
    },
    {
        id: 'services',
        title: '2. Descripción del Servicio y Canales',
        icon: MessageCircle,
        content: `La Plataforma consolida y centraliza la comunicación multi-canal integrando servicios de terceros como WhatsApp (Evolution API y WhatsApp Oficial), Instagram, TikTok y Webhooks personalizados.

El servicio incluye:
• Ingestión y enrutamiento automatizado de mensajes.
• Panel de control centralizado (Dashboard) para agentes y administradores.
• Herramientas de automatización y respuestas rápidas impulsadas por inteligencia artificial.
• Envío de mensajes masivos bajo las políticas de uso correspondientes de cada proveedor de canal.

Usted reconoce que la disponibilidad de los canales depende directamente de los proveedores de servicios externos (Meta, ByteDance, etc.), y que no somos responsables por interrupciones ocasionadas por fallas en sus respectivas APIs.`
    },
    {
        id: 'intellectual-property',
        title: '3. Propiedad Intelectual',
        icon: BookOpen,
        content: `Todos los derechos de propiedad intelectual sobre la interfaz, código fuente, algoritmos, diseños visuales, bases de datos y marcas comerciales integradas en la Plataforma son propiedad exclusiva de la empresa o de sus respectivos licenciantes.

Se otorga una licencia limitada, no exclusiva, intransferible y revocable para acceder y utilizar la Plataforma estrictamente de acuerdo con estos términos. Queda prohibida la reproducción, distribución, modificación, descompilación o ingeniería inversa de cualquier componente del software.`
    },
    {
        id: 'data-protection',
        title: '4. Privacidad y Protección de Datos',
        icon: Shield,
        content: `Nos comprometemos a proteger la privacidad de sus datos y la de sus clientes de acuerdo con la legislación de protección de datos personales aplicable (incluyendo la Ley de Habeas Data).

El tratamiento de los datos recolectados se rige por nuestra Política de Privacidad. La Plataforma actúa como Encargado del Tratamiento de los datos de contacto y mensajes que transitan por la misma, siendo usted el único Responsable del Tratamiento y de obtener el consentimiento previo y explícito de los destinatarios para el envío de comunicaciones.`
    },
    {
        id: 'responsibilities',
        title: '5. Responsabilidades del Usuario',
        icon: Scale,
        content: `Como usuario de la Plataforma, usted se compromete a:
• No utilizar el servicio para enviar spam, mensajes no deseados o contenido acosador, difamatorio, obsceno o ilegal.
• Mantener la confidencialidad de sus credenciales de acceso y reportar inmediatamente cualquier uso no autorizado.
• No realizar actividades que puedan saturar, dañar o deshabilitar la infraestructura de la Plataforma.
• Cumplir de forma estricta con las políticas de comercio de WhatsApp, las políticas de comunidad de Instagram y las pautas de TikTok.

El incumplimiento de estas obligaciones facultará a la administración para suspender o cancelar su cuenta de manera inmediata sin derecho a reembolso.`
    },
    {
        id: 'guarantees',
        title: '6. Limitación de Responsabilidad',
        icon: AlertCircle,
        content: `LA PLATAFORMA SE PROPORCIONA "TAL CUAL" Y "SEGÚN DISPONIBILIDAD". NO OFRECEMOS GARANTÍAS EXPRESAS O IMPLÍCITAS DE QUE EL FUNCIONAMIENTO SERÁ ININTERRUMPIDO, LIBRE DE ERRORES O QUE CUMPLIRÁ CON EXPECTATIVAS ESPECÍFICAS.

En ningún caso seremos responsables por daños indirectos, incidentales, especiales o consecuentes (incluyendo pérdida de beneficios, datos o interrupción del negocio) que surjan del uso o de la imposibilidad de usar la Plataforma, incluso si hemos sido notificados de la posibilidad de tales daños.`
    },
    {
        id: 'modifications',
        title: '7. Modificaciones a los Términos',
        icon: RefreshCw,
        content: `Nos reservamos el derecho de revisar y actualizar estos Términos y Condiciones en cualquier momento. Los cambios se harán efectivos inmediatamente después de su publicación en esta página. 

El uso continuo de la Plataforma tras la modificación de los términos constituirá su aceptación de los nuevos términos. Le recomendamos revisar esta página periódicamente para mantenerse informado.`
    },
    {
        id: 'contact',
        title: '8. Contacto y Soporte',
        icon: PhoneCall,
        content: `Si tiene alguna pregunta, inquietud o reclamación relacionada con estos Términos y Condiciones, o si necesita soporte técnico con respecto al uso de los canales, por favor contáctenos a través de:

• Soporte Corporativo en Línea
• Correo Electrónico: soporte@chatbot-multicanal.com
• WhatsApp de Atención: +57 300 000 0000

Estaremos encantados de resolver sus inquietudes a la mayor brevedad posible.`
    }
];

export default function TermsAndConditions() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSection, setActiveSection] = useState('acceptance');

    const handlePrint = () => {
        window.print();
    };

    const handleGoBack = () => {
        // Redirect to main page
        window.location.href = '/';
    };

    // Filter or highlight sections based on search query
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return SECTIONS;
        const query = searchQuery.toLowerCase();
        return SECTIONS.filter(sec => 
            sec.title.toLowerCase().includes(query) || 
            sec.content.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    return (
        <div style={styles.container}>
            {/* Background elements */}
            <div style={styles.bgBlob1}></div>
            <div style={styles.bgBlob2}></div>

            <div style={styles.contentWrapper}>
                {/* Header Section */}
                <header style={styles.header}>
                    <button onClick={handleGoBack} style={styles.backButton} className="hover-scale">
                        <ArrowLeft size={18} />
                        <span>Volver al Inicio</span>
                    </button>
                    
                    <div style={styles.titleContainer}>
                        <FileText size={40} style={styles.mainIcon} />
                        <h1 style={styles.mainTitle}>Términos y Condiciones</h1>
                    </div>
                    <p style={styles.subtitle}>
                        Última actualización: 10 de Junio, 2026. Por favor lea estos términos cuidadosamente antes de usar la plataforma.
                    </p>

                    {/* Actions and Search Bar */}
                    <div style={styles.actionsBar}>
                        <div style={styles.searchContainer}>
                            <Search size={18} style={styles.searchIcon} />
                            <input 
                                type="text" 
                                placeholder="Buscar en los términos..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={styles.searchInput}
                            />
                        </div>
                        <button onClick={handlePrint} style={styles.printButton} className="hover-scale">
                            <Printer size={18} />
                            <span>Imprimir Términos</span>
                        </button>
                    </div>
                </header>

                {/* Main Content Body */}
                <div style={styles.bodyGrid}>
                    {/* Sidebar navigation */}
                    <aside style={styles.sidebar}>
                        <h3 style={styles.sidebarTitle}>Secciones</h3>
                        <nav style={styles.nav}>
                            {SECTIONS.map((sec) => {
                                const Icon = sec.icon;
                                const isActive = activeSection === sec.id;
                                return (
                                    <button 
                                        key={sec.id}
                                        onClick={() => {
                                            setActiveSection(sec.id);
                                            const element = document.getElementById(sec.id);
                                            if (element) {
                                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }
                                        }}
                                        style={{
                                            ...styles.navItem,
                                            ...(isActive ? styles.navItemActive : {})
                                        }}
                                        className="nav-item-hover"
                                    >
                                        <Icon size={18} style={isActive ? styles.navIconActive : styles.navIcon} />
                                        <span style={styles.navText}>{sec.title.split('. ')[1]}</span>
                                        {isActive && <Check size={14} style={styles.checkMark} />}
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                    {/* Terms text content */}
                    <main style={styles.textContainer}>
                        {filteredSections.length > 0 ? (
                            filteredSections.map((sec) => {
                                const Icon = sec.icon;
                                return (
                                    <section 
                                        key={sec.id} 
                                        id={sec.id} 
                                        style={styles.sectionCard}
                                        className="section-card-anim"
                                    >
                                        <div style={styles.sectionHeader}>
                                            <div style={styles.iconCircle}>
                                                <Icon size={20} style={styles.sectionIcon} />
                                            </div>
                                            <h2 style={styles.sectionTitle}>{sec.title}</h2>
                                        </div>
                                        <div style={styles.sectionContent}>
                                            {sec.content.split('\n\n').map((para, i) => (
                                                <p key={i} style={styles.paragraph}>
                                                    {para.split('\n').map((line, j) => (
                                                        <React.Fragment key={j}>
                                                            {line}
                                                            {j < para.split('\n').length - 1 && <br />}
                                                        </React.Fragment>
                                                    ))}
                                                </p>
                                            ))}
                                        </div>
                                    </section>
                                );
                            })
                        ) : (
                            <div style={styles.noResultsCard}>
                                <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 8px 0', color: '#1f2937' }}>
                                    No se encontraron resultados
                                </h3>
                                <p style={{ color: '#6b7280', margin: 0 }}>
                                    Intente buscar con otros términos clave.
                                </p>
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* CSS styles to inject */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                
                body {
                    font-family: 'Inter', sans-serif !important;
                }

                .hover-scale {
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .hover-scale:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }
                .hover-scale:active {
                    transform: translateY(0);
                }

                .nav-item-hover {
                    transition: all 0.2s ease;
                }
                .nav-item-hover:hover {
                    background: rgba(17, 171, 156, 0.05) !important;
                    color: #11ab9c !important;
                    padding-left: 20px !important;
                }

                .section-card-anim {
                    transition: all 0.3s ease;
                }
                .section-card-anim:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05) !important;
                    border-color: rgba(17, 171, 156, 0.2) !important;
                }

                @media print {
                    body {
                        background: white !important;
                        color: black !important;
                    }
                    div[style*="container"] {
                        padding: 0 !important;
                        background: none !important;
                    }
                    div[style*="bgBlob"] {
                        display: none !important;
                    }
                    button, header nav, aside, .actionsBar {
                        display: none !important;
                    }
                    main {
                        width: 100% !important;
                        margin: 0 !important;
                    }
                    div[style*="sectionCard"] {
                        box-shadow: none !important;
                        border: none !important;
                        margin-bottom: 2rem !important;
                        page-break-inside: avoid !important;
                    }
                }
            `}</style>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        color: '#334155',
        position: 'relative',
        overflow: 'hidden',
        padding: '40px 20px',
        fontFamily: "'Inter', sans-serif"
    },
    bgBlob1: {
        position: 'absolute',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(17, 171, 156, 0.08) 0%, rgba(255,255,255,0) 70%)',
        top: '-10%',
        left: '-10%',
        zIndex: 0,
        pointerEvents: 'none'
    },
    bgBlob2: {
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, rgba(255,255,255,0) 70%)',
        bottom: '-10%',
        right: '-10%',
        zIndex: 0,
        pointerEvents: 'none'
    },
    contentWrapper: {
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
    },
    header: {
        marginBottom: '40px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    backButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '24px',
        padding: '8px 16px',
        fontSize: '0.875rem',
        fontWeight: '500',
        color: '#64748b',
        cursor: 'pointer',
        alignSelf: 'flex-start',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    },
    titleContainer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        marginBottom: '16px'
    },
    mainIcon: {
        color: '#11ab9c'
    },
    mainTitle: {
        fontSize: '2.5rem',
        fontWeight: '800',
        color: '#1e293b',
        margin: 0,
        letterSpacing: '-0.025em'
    },
    subtitle: {
        fontSize: '1rem',
        color: '#64748b',
        maxWidth: '700px',
        lineHeight: '1.6',
        margin: '0 0 32px 0'
    },
    actionsBar: {
        display: 'flex',
        width: '100%',
        maxWidth: '750px',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap'
    },
    searchContainer: {
        flex: 1,
        minWidth: '280px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center'
    },
    searchIcon: {
        position: 'absolute',
        left: '16px',
        color: '#94a3b8'
    },
    searchInput: {
        width: '100%',
        padding: '12px 16px 12px 48px',
        borderRadius: '12px',
        border: '1px solid #cbd5e1',
        background: '#ffffff',
        fontSize: '0.95rem',
        color: '#1e293b',
        outline: 'none',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        transition: 'all 0.2s ease',
        ':focus': {
            borderColor: '#11ab9c',
            boxShadow: '0 0 0 3px rgba(17, 171, 156, 0.15)'
        }
    },
    printButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: '#11ab9c',
        border: 'none',
        borderRadius: '12px',
        padding: '12px 20px',
        fontSize: '0.95rem',
        fontWeight: '600',
        color: '#ffffff',
        cursor: 'pointer',
        boxShadow: '0 4px 6px -1px rgba(17, 171, 156, 0.2)'
    },
    bodyGrid: {
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: '32px',
        alignItems: 'start',
        '@media (max-width: 968px)': {
            gridTemplateColumns: '1fr'
        }
    },
    sidebar: {
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        padding: '24px',
        position: 'sticky',
        top: '20px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
    },
    sidebarTitle: {
        fontSize: '0.75rem',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: '#94a3b8',
        margin: '0 0 16px 0',
        paddingLeft: '8px'
    },
    nav: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    navItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'transparent',
        border: 'none',
        borderRadius: '8px',
        padding: '10px 12px',
        textAlign: 'left',
        fontSize: '0.875rem',
        fontWeight: '500',
        color: '#475569',
        cursor: 'pointer',
        width: '100%',
        position: 'relative'
    },
    navItemActive: {
        background: 'rgba(17, 171, 156, 0.08)',
        color: '#11ab9c',
        fontWeight: '600'
    },
    navIcon: {
        color: '#94a3b8'
    },
    navIconActive: {
        color: '#11ab9c'
    },
    navText: {
        flex: 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    checkMark: {
        color: '#11ab9c'
    },
    textContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
    },
    sectionCard: {
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '32px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)'
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '20px',
        borderBottom: '1px solid #f1f5f9',
        paddingBottom: '16px'
    },
    iconCircle: {
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: 'rgba(17, 171, 156, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    sectionIcon: {
        color: '#11ab9c'
    },
    sectionTitle: {
        fontSize: '1.25rem',
        fontWeight: '700',
        color: '#1e293b',
        margin: 0
    },
    sectionContent: {
        color: '#475569',
        lineHeight: '1.75',
        fontSize: '0.975rem'
    },
    paragraph: {
        margin: '0 0 16px 0',
        ':last-child': {
            margin: 0
        }
    },
    noResultsCard: {
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '48px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
    }
};
