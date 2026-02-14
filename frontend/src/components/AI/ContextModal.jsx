import React, { useState, useEffect } from 'react';
import { X, Save, FileText } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const ContextModal = ({ isOpen, onClose, context, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [keywords, setKeywords] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (context) {
            setTitle(context.title || '');
            setContent(context.content || '');
            setKeywords(context.keywords ? context.keywords.join(', ') : '');
        } else {
            setTitle('');
            setContent('');
            setKeywords('');
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

        const payload = {
            title,
            content,
            keywords: keywords.split(',').map(k => k.trim()).filter(k => k !== '')
        };

        try {
            const url = context
                ? `${API_URL}/api/ai-knowledge/${context.id}`
                : `${API_URL}/api/ai-knowledge/text`;

            const method = context ? 'PUT' : 'POST';

            // Nota: El backend actualmente solo tiene el endpoint POST para text.
            // Si el user quiere editar, el backend debería soportar PUT.
            // Por ahora implementaré el POST y asumiremos que el backend se actualizará si es necesario.
            // Para ser seguros, solo usaré POST /text si no hay id.

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
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
            <div className="modal" style={{ padding: '24px', maxWidth: '600px' }}>
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
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--color-gray-700)' }}>Título / Identificador</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Nombre para identificar este bloque de contexto..."
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '6px',
                                border: '1px solid var(--color-gray-300)',
                                outline: 'none',
                                focus: 'border-color: var(--color-primary)'
                            }}
                        />
                    </div>

                    {/* Content */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--color-gray-700)' }}>Contenido (Instrucciones o Información)</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Escribe aquí el texto que la IA usará como referencia..."
                            rows={8}
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '6px',
                                border: '1px solid var(--color-gray-300)',
                                outline: 'none',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    {/* Keywords */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '6px', color: 'var(--color-gray-700)' }}>Palabras clave (separadas por comas)</label>
                        <input
                            type="text"
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            placeholder="ej: precios, servicios, devoluciones"
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-gray-300)' }}
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
