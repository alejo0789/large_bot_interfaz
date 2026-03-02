import React, { useState, useEffect } from 'react';
import { X, Save, Wrench, DollarSign } from 'lucide-react';
import apiFetch, { API_URL } from '../../utils/api';

const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: '12px',
    border: '1.5px solid #e5e7eb', outline: 'none',
    fontSize: '0.95rem', transition: 'border-color 0.2s',
    boxSizing: 'border-box', fontFamily: 'inherit'
};
const labelStyle = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: '#374151' };

const ServicioModal = ({ isOpen, onClose, item, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [price, setPrice] = useState('');
    const [file, setFile] = useState(null);
    const [mediaUrl, setMediaUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        setTitle(item?.title || '');
        setContent(item?.content || '');
        setPrice(item?.price !== null && item?.price !== undefined ? String(item.price) : '');
        setFile(null);
        setMediaUrl(item?.media_url && !item.media_url.startsWith('/uploads') ? item.media_url : '');
        setError(null);
    }, [item, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) { setError('El nombre del servicio es obligatorio'); return; }
        setSaving(true);
        setError(null);

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('keywords', 'servicio');
        if (price !== '') formData.append('price', price);
        if (file) formData.append('file', file);
        else if (mediaUrl) formData.append('media_url', mediaUrl);
        else if (item?.media_url) formData.append('media_url', item.media_url);

        try {
            let url, method;
            if (item) { url = `/api/ai-knowledge/${item.id}`; method = 'PUT'; }
            else if (file) { url = `/api/ai-knowledge/upload`; method = 'POST'; }
            else { url = `/api/ai-knowledge/text`; method = 'POST'; }

            const res = await apiFetch(url, { method, body: formData });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error'); }
            onSuccess(await res.json());
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
            <div className="modal" style={{ maxWidth: '580px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                {/* Header */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ backgroundColor: 'rgba(59,130,246,0.1)', padding: '10px', borderRadius: '12px' }}>
                            <Wrench size={20} style={{ color: '#3b82f6' }} />
                        </div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                            {item ? 'Editar Servicio' : 'Nuevo Servicio'}
                        </h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                        <X size={20} style={{ color: '#6b7280' }} />
                    </button>
                </div>

                {/* Body scrollable */}
                <form
                    id="servicio-form"
                    onSubmit={handleSubmit}
                    style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0 }}
                >
                    {/* Nombre */}
                    <div>
                        <label style={labelStyle}>Nombre del servicio *</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="Ej: Corte de cabello, Consulta médica..." style={inputStyle}
                            onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                    </div>

                    {/* Precio */}
                    <div>
                        <label style={labelStyle}>
                            <DollarSign size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                            Precio <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span>
                        </label>
                        <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                            placeholder="Ej: 50000" style={{ ...inputStyle, maxWidth: '220px' }}
                            onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                    </div>

                    {/* Imagen */}
                    <div>
                        <label style={labelStyle}>Imagen del servicio <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span></label>
                        <div
                            style={{ width: '100%', minHeight: '100px', borderRadius: '14px', border: '2px dashed #e5e7eb', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', padding: '16px', transition: 'all 0.2s', boxSizing: 'border-box' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'rgba(18,140,126,0.02)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#fafafa'; }}
                            onClick={() => document.getElementById('servicio-img-upload').click()}
                        >
                            {previewUrl ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
                                    <img src={previewUrl} alt="Preview" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} />
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
                            <input id="servicio-img-upload" type="file" accept="image/*"
                                onChange={e => { if (e.target.files[0]) { setFile(e.target.files[0]); setMediaUrl(''); } }}
                                style={{ display: 'none' }} />
                        </div>
                        <input type="text" value={mediaUrl}
                            onChange={e => { setMediaUrl(e.target.value); if (e.target.value) setFile(null); }}
                            placeholder="O pega URL de imagen (https://...)"
                            style={{ ...inputStyle, marginTop: '8px', fontSize: '0.85rem', backgroundColor: '#f9fafb' }}
                            onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.backgroundColor = '#fff'; }}
                            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.backgroundColor = '#f9fafb'; }} />
                    </div>

                    {/* Descripción */}
                    <div>
                        <label style={labelStyle}>Descripción del servicio</label>
                        <textarea value={content} onChange={e => setContent(e.target.value)}
                            placeholder="Describe el servicio: qué incluye, duración, beneficios..."
                            rows={5} style={{ ...inputStyle, resize: 'vertical' }}
                            onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                    </div>

                    {error && (
                        <div style={{ padding: '10px 14px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '10px', fontSize: '0.875rem' }}>
                            ⚠️ {error}
                        </div>
                    )}
                </form>

                {/* Footer fijo */}
                <div style={{ flexShrink: 0, padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#fafafa', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
                    <button type="button" onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: '10px', backgroundColor: 'white', cursor: 'pointer', fontWeight: 500 }}>
                        Cancelar
                    </button>
                    <button type="submit" form="servicio-form" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', border: 'none', borderRadius: '10px', fontWeight: 600, color: 'white', cursor: saving ? 'default' : 'pointer', backgroundColor: saving ? 'var(--color-primary-light)' : 'var(--color-primary)' }}>
                        <Save size={16} />
                        {saving ? 'Guardando...' : 'Guardar Servicio'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ServicioModal;
