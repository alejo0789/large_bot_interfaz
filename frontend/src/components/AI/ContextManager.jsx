import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Search, FileText } from 'lucide-react';
import ContextModal from './ContextModal';

const API_URL = process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');

const ContextManager = () => {
    const [contexts, setContexts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedContext, setSelectedContext] = useState(null);

    const fetchContexts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/ai-knowledge?type=text`);
            const data = await res.json();

            // Safeguard: Ensure data is an array
            setContexts(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching contexts:', error);
            setContexts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContexts();
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este contexto?')) return;
        try {
            await fetch(`${API_URL}/api/ai-knowledge/${id}`, { method: 'DELETE' });
            setContexts(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            console.error('Error deleting context:', error);
        }
    };

    const handleSuccess = (context) => {
        // Si ya existe el ID, actualizamos. Si no, agregamos.
        // El backend actualmente solo tiene el endpoint POST /text, 
        // así que por ahora solo agregaremos al inicio si es nuevo.
        setContexts(prev => {
            const index = prev.findIndex(c => c.id === context.id);
            if (index !== -1) {
                const newContexts = [...prev];
                newContexts[index] = context;
                return newContexts;
            }
            return [context, ...prev];
        });
        setShowModal(false);
    };

    const openCreateModal = () => {
        setSelectedContext(null);
        setShowModal(true);
    };

    const openEditModal = (context) => {
        setSelectedContext(context);
        setShowModal(true);
    };

    const filteredContexts = (Array.isArray(contexts) ? contexts : []).filter(c =>
        (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.content || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Action Bar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                    <Search className="w-5 h-5" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                        type="text"
                        placeholder="Buscar en el contexto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 16px 12px 44px',
                            borderRadius: '14px',
                            border: '1.5px solid #e5e7eb',
                            fontSize: '0.95rem',
                            transition: 'all 0.2s',
                            outline: 'none',
                            backgroundColor: '#f9fafb'
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = 'var(--color-primary)';
                            e.target.style.backgroundColor = 'white';
                            e.target.style.boxShadow = '0 0 0 4px rgba(18, 140, 126, 0.1)';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#e5e7eb';
                            e.target.style.backgroundColor = '#f9fafb';
                            e.target.style.boxShadow = 'none';
                        }}
                    />
                </div>

                <button
                    className="btn"
                    onClick={openCreateModal}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 24px',
                        borderRadius: '14px',
                        backgroundColor: 'var(--color-primary)',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        boxShadow: '0 4px 12px rgba(18, 140, 126, 0.25)',
                        transition: 'all 0.3s ease',
                        border: 'none',
                        cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(18, 140, 126, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(18, 140, 126, 0.25)';
                    }}
                >
                    <Plus className="w-5 h-5" />
                    <span>Nuevo Contexto</span>
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '20px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px 0' }}>
                        <div className="loading-spinner" />
                        <p style={{ color: '#6b7280', marginTop: '16px' }}>Cargando base de conocimientos...</p>
                    </div>
                ) : filteredContexts.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '80px 40px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '24px',
                        border: '2px dashed #e2e8f0'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📝</div>
                        <h4 style={{ color: '#111827', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0' }}>
                            Sin contexto definido
                        </h4>
                        <p style={{ color: '#6b7280', margin: 0, maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                            {searchQuery ? 'No hay resultados para tu búsqueda.' : 'Crea bloques de texto para entrenar a la IA sobre cómo debe responder.'}
                        </p>
                        {!searchQuery && (
                            <button
                                className="btn"
                                onClick={openCreateModal}
                                style={{
                                    marginTop: '24px',
                                    color: 'var(--color-primary)',
                                    fontWeight: 700,
                                    background: 'white',
                                    border: '1.5px solid var(--color-primary)',
                                    padding: '10px 20px',
                                    borderRadius: '12px'
                                }}
                            >
                                Crear mi primer contexto
                            </button>
                        )}
                    </div>
                ) : (
                    filteredContexts.map(context => (
                        <div key={context.id} style={{
                            padding: '24px',
                            border: '1.5px solid #e5e7eb',
                            borderRadius: '20px',
                            backgroundColor: 'white',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            transition: 'all 0.3s ease',
                            cursor: 'default'
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                                e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.04)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                    <h4 style={{ fontWeight: 800, fontSize: '1.2rem', margin: 0, color: '#111827' }}>
                                        {context.title || 'Bloque sin título'}
                                    </h4>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        backgroundColor: 'var(--color-primary-light)',
                                        color: 'white',
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Documento
                                    </span>
                                </div>
                                {context.media_url && (
                                    <div style={{ marginTop: '16px', position: 'relative', width: 'fit-content' }}>
                                        <img
                                            src={`${API_URL}${context.media_url}`}
                                            alt={context.title}
                                            style={{
                                                maxWidth: '120px',
                                                maxHeight: '120px',
                                                borderRadius: '12px',
                                                border: '2px solid #f3f4f6',
                                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                                objectFit: 'cover'
                                            }}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                        <span style={{
                                            position: 'absolute',
                                            bottom: '6px',
                                            right: '6px',
                                            backgroundColor: 'rgba(0,0,0,0.5)',
                                            color: 'white',
                                            fontSize: '0.6rem',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            backdropFilter: 'blur(4px)'
                                        }}>
                                            Imagen
                                        </span>
                                    </div>
                                )}
                                <p style={{
                                    color: '#4b5563',
                                    whiteSpace: 'pre-wrap',
                                    maxHeight: '150px',
                                    overflow: 'hidden',
                                    fontSize: '1rem',
                                    lineHeight: '1.6',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 5,
                                    WebkitBoxOrient: 'vertical',
                                    marginTop: context.media_url ? '12px' : '0'
                                }}>
                                    {context.content}
                                </p>
                                {context.keywords && context.keywords.length > 0 && (
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '20px' }}>
                                        {context.keywords.map((k, i) => (
                                            <span key={i} style={{
                                                fontSize: '0.75rem',
                                                backgroundColor: '#f3f4f6',
                                                padding: '4px 12px',
                                                borderRadius: '10px',
                                                color: '#374151',
                                                fontWeight: 600,
                                                border: '1px solid #e5e7eb'
                                            }}>
                                                #{k}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginLeft: '24px' }}>
                                <button
                                    className="btn-icon"
                                    style={{
                                        color: '#4b5563',
                                        padding: '12px',
                                        backgroundColor: '#f3f4f6',
                                        borderRadius: '12px'
                                    }}
                                    onClick={() => openEditModal(context)}
                                    title="Editar"
                                >
                                    <Edit2 className="w-5 h-5" />
                                </button>
                                <button
                                    className="btn-icon"
                                    style={{
                                        color: '#ef4444',
                                        padding: '12px',
                                        backgroundColor: '#fee2e2',
                                        borderRadius: '12px'
                                    }}
                                    onClick={() => handleDelete(context.id)}
                                    title="Eliminar"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <ContextModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                context={selectedContext}
                onSuccess={handleSuccess}
            />
        </div >
    );
};

export default ContextManager;
