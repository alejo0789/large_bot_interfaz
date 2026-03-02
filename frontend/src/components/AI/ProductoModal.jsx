import React, { useState, useEffect } from 'react';
import { X, Save, ShoppingBag, DollarSign } from 'lucide-react';
import apiFetch, { API_URL } from '../../utils/api';

const labelStyle = {
    display: 'block', fontSize: '0.875rem', fontWeight: 600,
    marginBottom: '8px', color: '#374151'
};
const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: '12px',
    border: '1.5px solid #e5e7eb', outline: 'none',
    fontSize: '0.95rem', transition: 'border-color 0.2s',
    boxSizing: 'border-box', fontFamily: 'inherit'
};

const ProductoModal = ({ isOpen, onClose, item, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [keywords, setKeywords] = useState('');
    const [price, setPrice] = useState('');
    const [file, setFile] = useState(null);
    const [mediaUrl, setMediaUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (item) {
            setTitle(item.title || '');
            setContent(item.content || '');
            setKeywords(item.keywords ? item.keywords.join(', ') : '');
            setPrice(item.price !== null && item.price !== undefined ? String(item.price) : '');
            setFile(null);
            setMediaUrl(item.media_url && !item.media_url.startsWith('/uploads') ? item.media_url : '');
        } else {
            setTitle(''); setContent(''); setKeywords(''); setPrice('');
            setFile(null); setMediaUrl('');
        }
        setError(null);
    }, [item, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim()) { setError('La descripción es obligatoria'); return; }
        setSaving(true);
        setError(null);

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('keywords', keywords);
        if (price !== '') formData.append('price', price);
        if (file) formData.append('file', file);
        else if (mediaUrl) formData.append('media_url', mediaUrl);
        else if (item?.media_url) formData.append('media_url', item.media_url);

        try {
            const url = item ? `/api/ai-knowledge/${item.id}` : `/api/ai-knowledge/text`;
            const method = item ? 'PUT' : 'POST';
            const response = await apiFetch(url, { method, body: formData });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error al guardar');
            }
            onSuccess(await response.json());
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const getPreviewUrl = () => {
        if (file) return URL.createObjectURL(file);
        if (mediaUrl) return mediaUrl;
        if (item?.media_url) return item.media_url.startsWith('/') ? `${API_URL}${item.media_url}` : item.media_url;
        return null;
    };
    const previewUrl = getPreviewUrl();

    return (
        <div className="modal-overlay">
            {/* Modal: flex column para que header/footer sean fijos y body haga scroll */}
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
            >
                {/* ── HEADER FIJO ── */}
                <div style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 24px',
                    borderBottom: '1px solid #f3f4f6',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ backgroundColor: 'rgba(18,140,126,0.1)', padding: '10px', borderRadius: '12px' }}>
                            <ShoppingBag size={20} style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#111827' }}>
                            {item ? 'Editar Producto' : 'Nuevo Producto'}
                        </h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
                        <X size={20} style={{ color: '#6b7280' }} />
                    </button>
                </div>

                {/* ── BODY SCROLLABLE ── */}
                <form
                    id="producto-form"
                    onSubmit={handleSubmit}
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        minHeight: 0,
                    }}
                >
                    {/* Nombre */}
                    <div>
                        <label style={labelStyle}>Nombre del producto</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Ej: Shampoo de Cebolla 400ml"
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                        />
                    </div>

                    {/* Precio */}
                    <div>
                        <label style={labelStyle}>
                            <DollarSign size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                            Precio <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span>
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={price}
                            onChange={e => setPrice(e.target.value)}
                            placeholder="Ej: 25000"
                            style={{ ...inputStyle, maxWidth: '220px' }}
                            onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                        />
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '5px', marginBottom: 0 }}>
                            Déjalo vacío si no quieres mostrar precio
                        </p>
                    </div>

                    {/* Imagen */}
                    <div>
                        <label style={labelStyle}>
                            Imagen del producto <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span>
                        </label>
                        <div
                            style={{
                                width: '100%', minHeight: '100px', borderRadius: '14px',
                                border: '2px dashed #e5e7eb', backgroundColor: '#fafafa',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: '10px', cursor: 'pointer', padding: '16px',
                                transition: 'all 0.2s', boxSizing: 'border-box',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'rgba(18,140,126,0.02)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#fafafa'; }}
                            onClick={() => document.getElementById('producto-img-upload').click()}
                        >
                            {previewUrl ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
                                    <img src={previewUrl} alt="Preview" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '10px', border: '2px solid #f3f4f6', flexShrink: 0 }} />
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>{file ? file.name : 'Imagen actual'}</p>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>Clic para cambiar</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={{ fontSize: '1.8rem' }}>🖼️</div>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>Clic para subir imagen</p>
                                </>
                            )}
                            <input
                                id="producto-img-upload"
                                type="file"
                                accept="image/*"
                                onChange={e => { if (e.target.files[0]) { setFile(e.target.files[0]); setMediaUrl(''); } }}
                                style={{ display: 'none' }}
                            />
                        </div>
                        <input
                            type="text"
                            value={mediaUrl}
                            onChange={e => { setMediaUrl(e.target.value); if (e.target.value) setFile(null); }}
                            placeholder="O pega una URL de imagen (https://...)"
                            style={{ ...inputStyle, marginTop: '8px', fontSize: '0.85rem', backgroundColor: '#f9fafb' }}
                            onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.backgroundColor = '#fff'; }}
                            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.backgroundColor = '#f9fafb'; }}
                        />
                    </div>

                    {/* Descripción */}
                    <div>
                        <label style={labelStyle}>Descripción / Información detallada *</label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Describe el producto: ingredientes, beneficios, modo de uso..."
                            rows={5}
                            style={{ ...inputStyle, resize: 'vertical' }}
                            onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                        />
                    </div>

                    {/* Keywords */}
                    <div>
                        <label style={labelStyle}>Palabras clave <span style={{ fontWeight: 400, color: '#9ca3af' }}>(separadas por comas)</span></label>
                        <input
                            type="text"
                            value={keywords}
                            onChange={e => setKeywords(e.target.value)}
                            placeholder="Ej: shampoo, cebolla, cabello, crecimiento"
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                        />
                    </div>

                    {error && (
                        <div style={{ padding: '10px 14px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '10px', fontSize: '0.875rem' }}>
                            ⚠️ {error}
                        </div>
                    )}
                </form>

                {/* ── FOOTER FIJO ── */}
                <div style={{
                    flexShrink: 0,
                    padding: '16px 24px',
                    borderTop: '1px solid #f3f4f6',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    backgroundColor: '#fafafa',
                    borderBottomLeftRadius: 'var(--radius-xl)',
                    borderBottomRightRadius: 'var(--radius-xl)',
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: '10px', backgroundColor: 'white', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem' }}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="producto-form"
                        disabled={saving}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 24px', border: 'none', borderRadius: '10px',
                            fontWeight: 600, color: 'white', cursor: saving ? 'default' : 'pointer', fontSize: '0.9rem',
                            backgroundColor: saving ? 'var(--color-primary-light)' : 'var(--color-primary)',
                            opacity: saving ? 0.8 : 1,
                        }}
                    >
                        <Save size={16} />
                        {saving ? 'Guardando...' : 'Guardar Producto'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductoModal;
