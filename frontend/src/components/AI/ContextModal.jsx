import React, { useState, useEffect } from 'react';
import { X, Save, FileText } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const ContextModal = ({ isOpen, onClose, context, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [keywords, setKeywords] = useState('');
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (context) {
            setTitle(context.title || '');
            setContent(context.content || '');
            setKeywords(context.keywords ? context.keywords.join(', ') : '');
            setFile(null);
        } else {
            setTitle('');
            setContent('');
            setKeywords('');
            setFile(null);
        }
    }, [context, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content) {
            setError('El contenido es obligatorio');
            return;
        }

        setSaving(true);
        setError(null);

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('keywords', keywords);
        if (file) {
            formData.append('file', file);
        }

        try {
            const url = context
                ? `${API_URL}/api/ai-knowledge/${context.id}`
                : `${API_URL}/api/ai-knowledge/text`;

            const method = context ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                // Quitar 'Content-Type' permite al navegador establecerlo automáticamente con el boundary
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error al guardar contexto');
            }

            const savedContext = await response.json();
            onSuccess(savedContext);
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ padding: '24px', maxWidth: '600px', overflowY: 'auto', maxHeight: '90vh' }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'none', cursor: 'pointer' }}
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <div style={{ backgroundColor: 'var(--color-primary-light)', padding: '8px', borderRadius: '8px' }}>
                        <FileText className="w-5 h-5 text-primary-dark" />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                        {context ? 'Editar Contexto' : 'Nuevo Contexto de Texto'}
                    </h3>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Title */}
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-gray-700)' }}>
                            <FileText className="w-4 h-4 text-gray-400" />
                            Título / Identificador
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Nombre del producto o servicio (ej: Aceite de Cebolla)..."
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: '12px',
                                border: '1.5px solid var(--color-gray-200)',
                                outline: 'none',
                                fontSize: '0.95rem',
                                transition: 'all 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--color-gray-200)'}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-gray-700)' }}>
                            Imagen del Contexto
                        </label>

                        <div
                            style={{
                                width: '100%',
                                minHeight: '140px',
                                borderRadius: '16px',
                                border: '2px dashed var(--color-gray-200)',
                                backgroundColor: '#fcfcfc',
                                transition: 'all 0.3s ease',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                padding: '20px',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                                e.currentTarget.style.backgroundColor = 'rgba(18, 140, 126, 0.02)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-gray-200)';
                                e.currentTarget.style.backgroundColor = '#fcfcfc';
                            }}
                            onClick={() => document.getElementById('context-image-upload').click()}
                        >
                            {(file || (context?.media_url && !file)) ? (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ position: 'relative', width: '100px', height: '100px', flexShrink: 0 }}>
                                        <img
                                            src={file ? URL.createObjectURL(file) : `${API_URL}${context.media_url}`}
                                            alt="Preview"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
                                        />
                                        <div style={{
                                            position: 'absolute',
                                            top: '-8px',
                                            right: '-8px',
                                            backgroundColor: 'var(--color-primary)',
                                            color: 'white',
                                            borderRadius: '50%',
                                            padding: '4px',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                        }}>
                                            <Save className="w-3 h-3" />
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-gray-800)', margin: 0 }}>
                                            {file ? file.name : 'Imagen actual'}
                                        </p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', margin: '4px 0 0 0' }}>
                                            Haga clic aquí para cambiar la imagen
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        backgroundColor: '#f3f4f6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#9ca3af'
                                    }}>
                                        <X className="w-6 h-6" style={{ transform: 'rotate(45deg)' }} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#4b5563' }}>
                                            Subir imagen del producto
                                        </p>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                                            JPG, PNG o WEBP (Máx. 5MB)
                                        </p>
                                    </div>
                                </>
                            )}

                            <input
                                id="context-image-upload"
                                type="file"
                                accept="image/*"
                                onChange={(e) => setFile(e.target.files[0])}
                                style={{ display: 'none' }}
                            />
                        </div>
                    </div>

                    {/* Content */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-gray-700)' }}>
                            Información Detallada
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Describe precios, beneficios y detalles del producto o servicio..."
                            rows={6}
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: '12px',
                                border: '1.5px solid var(--color-gray-200)',
                                outline: 'none',
                                resize: 'vertical',
                                fontSize: '0.95rem',
                                transition: 'all 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--color-gray-200)'}
                        />
                    </div>

                    {/* Keywords */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-gray-700)' }}>
                            Palabras clave (separadas por comas)
                        </label>
                        <input
                            type="text"
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            placeholder="ej: aceite, cebolla, cabello, crecimiento"
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: '12px',
                                border: '1.5px solid var(--color-gray-200)',
                                outline: 'none',
                                fontSize: '0.95rem',
                                transition: 'all 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--color-gray-200)'}
                        />
                    </div>

                    {error && <p style={{ color: 'var(--color-red-500)', fontSize: '0.875rem' }}>{error}</p>}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '10px 20px',
                                border: '1px solid var(--color-gray-300)',
                                borderRadius: '6px',
                                backgroundColor: 'white',
                                cursor: 'pointer',
                                fontWeight: 500
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                border: 'none',
                                borderRadius: '6px',
                                backgroundColor: saving ? 'var(--color-primary-light)' : 'var(--color-primary)',
                                color: 'white',
                                cursor: saving ? 'default' : 'pointer',
                                fontWeight: 600
                            }}
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : 'Guardar Contexto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ContextModal;
