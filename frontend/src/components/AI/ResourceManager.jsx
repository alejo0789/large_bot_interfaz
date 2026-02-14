import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Search, Filter } from 'lucide-react';
import UploadModal from './UploadModal';

const API_URL = process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');

const ResourceManager = ({ type, title }) => {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchResources = async () => {
        setLoading(true);
        try {
            let queryUrl = `${API_URL}/api/ai-knowledge`;
            // Si el tipo es 'image', filtramos por ese. Si es 'media', el backend 
            // no tiene un filtro 'media' pero filtramos audio/video en el cliente
            // para este componente específico.
            if (type === 'image') {
                queryUrl += `?type=image`;
            }

            const res = await fetch(queryUrl);
            const data = await res.json();

            // Safeguard: Ensure data is an array
            const dataArray = Array.isArray(data) ? data : [];

            let filtered = dataArray;
            if (type === 'media') {
                filtered = dataArray.filter(item => item.type === 'audio' || item.type === 'video');
            }

            setResources(filtered);
        } catch (error) {
            console.error('Error fetching resources:', error);
            setResources([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResources();
    }, [type]);

    const handleDelete = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este recurso?')) return;
        try {
            await fetch(`${API_URL}/api/ai-knowledge/${id}`, { method: 'DELETE' });
            setResources(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            console.error('Error deleting resource:', error);
        }
    };

    const handleUploadSuccess = (newResource) => {
        setResources(prev => [newResource, ...prev]);
        setShowUploadModal(false);
    };

    const filteredResources = (Array.isArray(resources) ? resources : []).filter(r =>
        (r.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.filename || '').toLowerCase().includes(searchQuery.toLowerCase())
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
                        placeholder={`Buscar en ${title.toLowerCase()}...`}
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
                    onClick={() => setShowUploadModal(true)}
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
                    <Upload className="w-5 h-5" />
                    <span>Subir {type === 'image' ? 'Imagen' : 'Archivo'}</span>
                </button>
            </div>

            {/* Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
                gap: '24px',
                paddingBottom: '20px'
            }}>
                {loading ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px 0' }}>
                        <div className="loading-spinner" />
                        <p style={{ color: '#6b7280', marginTop: '16px' }}>Cargando recursos...</p>
                    </div>
                ) : filteredResources.length === 0 ? (
                    <div style={{
                        gridColumn: '1/-1',
                        textAlign: 'center',
                        padding: '80px 40px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '24px',
                        border: '2px dashed #e2e8f0'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📦</div>
                        <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 8px 0' }}>
                            No se encontraron recursos
                        </h4>
                        <p style={{ color: '#6b7280', margin: 0 }}>
                            {searchQuery ? 'Prueba con otra búsqueda o ' : '¡Parece que esta sección está vacía! '}
                            {searchQuery ? '' : 'Sube tu primer archivo.'}
                        </p>
                    </div>
                ) : (
                    filteredResources.map(resource => (
                        <div
                            key={resource.id}
                            style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '20px',
                                overflow: 'hidden',
                                backgroundColor: 'white',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'all 0.3s ease',
                                cursor: 'default'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)';
                                e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.borderColor = '#e5e7eb';
                            }}
                        >
                            {/* Preview */}
                            <div style={{
                                height: '180px',
                                backgroundColor: '#f3f4f6',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                {resource.type === 'image' ? (
                                    <img
                                        src={`${API_URL}${resource.media_url}`}
                                        alt={resource.filename}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '64px',
                                            height: '64px',
                                            backgroundColor: 'white',
                                            borderRadius: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '2rem',
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                                        }}>
                                            {resource.type === 'video' ? '🎬' : '🎵'}
                                        </div>
                                    </div>
                                )}

                                <div style={{
                                    position: 'absolute',
                                    top: '12px',
                                    left: '12px',
                                    padding: '4px 10px',
                                    backgroundColor: 'rgba(255,255,255,0.9)',
                                    backdropFilter: 'blur(4px)',
                                    borderRadius: '8px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: '#4b5563',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}>
                                    {resource.type}
                                </div>
                            </div>

                            {/* Info */}
                            <div style={{ padding: '16px' }}>
                                <p style={{
                                    fontWeight: 700,
                                    fontSize: '0.95rem',
                                    color: '#111827',
                                    margin: '0 0 6px 0',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {resource.filename}
                                </p>
                                <p style={{
                                    fontSize: '0.85rem',
                                    color: '#6b7280',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    lineHeight: '1.5',
                                    height: '2.55rem'
                                }}>
                                    {resource.content || 'Sin descripción añadida'}
                                </p>

                                {resource.keywords && resource.keywords.length > 0 && (
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                                        {resource.keywords.slice(0, 3).map((k, i) => (
                                            <span key={i} style={{
                                                fontSize: '0.7rem',
                                                backgroundColor: 'rgba(18, 140, 126, 0.08)',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                color: 'var(--color-primary-dark)',
                                                fontWeight: 600
                                            }}>
                                                #{k}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Actions overlay */}
                            <button
                                onClick={() => handleDelete(resource.id)}
                                style={{
                                    position: 'absolute',
                                    top: '12px',
                                    right: '12px',
                                    padding: '8px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    backdropFilter: 'blur(4px)',
                                    borderRadius: '10px',
                                    border: '1px solid #fee2e2',
                                    cursor: 'pointer',
                                    color: '#ef4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#ef4444';
                                    e.currentTarget.style.color = 'white';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                                    e.currentTarget.style.color = '#ef4444';
                                }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>

            <UploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                type={type}
                onSuccess={handleUploadSuccess}
                title={title}
            />
        </div>
    );
};

export default ResourceManager;
