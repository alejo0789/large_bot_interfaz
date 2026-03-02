import React, { useState, useEffect } from 'react';
import { X, Save, Megaphone, ToggleLeft, ToggleRight } from 'lucide-react';
import apiFetch, { API_URL } from '../../utils/api';

const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: '12px',
    border: '1.5px solid #e5e7eb', outline: 'none',
    fontSize: '0.95rem', transition: 'border-color 0.2s',
    boxSizing: 'border-box', fontFamily: 'inherit'
};
const labelStyle = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: '#374151' };

const PromocionModal = ({ isOpen, onClose, item, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [active, setActive] = useState(true);
    const [file, setFile] = useState(null);
    const [mediaUrl, setMediaUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        setTitle(item?.title || '');
        setContent(item?.content || '');
        setActive(item?.active !== false);
        setFile(null);
        setMediaUrl(item?.media_url && !item.media_url.startsWith('/uploads') ? item.media_url : '');
        setError(null);
    }, [item, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim()) { setError('El texto es obligatorio'); return; }
        setSaving(true);
        setError(null);

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('active', active ? 'true' : 'false');
        formData.append('keywords', 'promocion');

        if (file) formData.append('file', file);
        else if (mediaUrl) formData.append('media_url', mediaUrl);
        else if (item?.media_url) formData.append('media_url', item.media_url);

        try {
            // Si hay archivo nuevo y es creación, usar /upload; si no, usar /text
            let url, method;
            if (item) {
                url = `/api/ai-knowledge/${item.id}`;
                method = 'PUT';
            } else if (file) {
                url = `/api/ai-knowledge/upload`;
                method = 'POST';
            } else {
                url = `/api/ai-knowledge/text`;
                method = 'POST';
            }

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
            <div className="modal" style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

                {/* ── HEADER FIJO ── */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ backgroundColor: 'rgba(251,146,60,0.12)', padding: '10px', borderRadius: '12px' }}>
                            <Megaphone size={20} style={{ color: '#f97316' }} />
                        </div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                            {item ? 'Editar Promoción' : 'Nueva Promoción'}
                        </h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                        <X size={20} style={{ color: '#6b7280' }} />
                    </button>
                </div>

                {/* ── BODY SCROLLABLE ── */}
                <form
                    id="promo-form"
                    onSubmit={handleSubmit}
                    style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0 }}
                >
                    {/* Nombre */}
                    <div>
                        <label style={labelStyle}>Nombre de la promoción</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="Ej: Descuento 20% en shampoos" style={inputStyle}
                            onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                    </div>

                    {/* Estado activo */}
                    <div>
                        <label style={labelStyle}>Estado</label>
                        <button type="button" onClick={() => setActive(p => !p)} style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px',
                            borderRadius: '12px', border: `1.5px solid ${active ? '#bbf7d0' : '#e5e7eb'}`,
                            backgroundColor: active ? '#f0fdf4' : '#f9fafb', cursor: 'pointer', width: '100%', transition: 'all 0.2s'
                        }}>
                            {active ? <ToggleRight size={24} style={{ color: '#16a34a' }} /> : <ToggleLeft size={24} style={{ color: '#9ca3af' }} />}
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: active ? '#16a34a' : '#6b7280' }}>
                                {active ? 'Activa — la IA la mencionará a clientes' : 'Inactiva — la IA la ignorará'}
                            </span>
                        </button>
                    </div>

                    {/* Texto de promoción */}
                    <div>
                        <label style={labelStyle}>Texto de la promoción *</label>
                        <textarea value={content} onChange={e => setContent(e.target.value)}
                            placeholder="Describe la promoción: qué incluye, fechas, condiciones..."
                            rows={5} style={{ ...inputStyle, resize: 'vertical' }}
                            onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                    </div>

                    {/* Imagen */}
                    <div>
                        <label style={labelStyle}>
                            Imagen de la promoción <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span>
                        </label>
                        <div
                            style={{
                                width: '100%', minHeight: '100px', borderRadius: '14px',
                                border: '2px dashed #e5e7eb', backgroundColor: '#fafafa',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: '10px', cursor: 'pointer', padding: '16px',
                                transition: 'all 0.2s', boxSizing: 'border-box',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.02)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#fafafa'; }}
                            onClick={() => document.getElementById('promo-img-upload').click()}
                        >
                            {previewUrl ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
                                    <img src={previewUrl} alt="Preview"
                                        style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '10px', border: '2px solid #f3f4f6', flexShrink: 0 }}
                                        onError={e => { e.target.style.display = 'none'; }}
                                    />
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>
                                            {file ? file.name : 'Imagen actual'}
                                        </p>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>Clic para cambiar</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={{ fontSize: '1.8rem' }}>📣</div>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>Clic para subir imagen</p>
                                </>
                            )}
                            <input
                                id="promo-img-upload"
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
                            onFocus={e => { e.target.style.borderColor = '#f97316'; e.target.style.backgroundColor = '#fff'; }}
                            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.backgroundColor = '#f9fafb'; }}
                        />
                    </div>

                    {error && (
                        <div style={{ padding: '10px 14px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '10px', fontSize: '0.875rem' }}>
                            ⚠️ {error}
                        </div>
                    )}
                </form>

                {/* ── FOOTER FIJO ── */}
                <div style={{ flexShrink: 0, padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#fafafa', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
                    <button type="button" onClick={onClose}
                        style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: '10px', backgroundColor: 'white', cursor: 'pointer', fontWeight: 500 }}>
                        Cancelar
                    </button>
                    <button type="submit" form="promo-form" disabled={saving}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', border: 'none', borderRadius: '10px', fontWeight: 600, color: 'white', cursor: saving ? 'default' : 'pointer', backgroundColor: saving ? 'var(--color-primary-light)' : 'var(--color-primary)', opacity: saving ? 0.8 : 1 }}>
                        <Save size={16} />
                        {saving ? 'Guardando...' : 'Guardar Promoción'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PromocionModal;
