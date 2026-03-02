import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Search, Megaphone, ToggleLeft, ToggleRight } from 'lucide-react';
import PromocionModal from './PromocionModal';
import apiFetch, { API_URL } from '../../utils/api';

const PromocionesManager = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selected, setSelected] = useState(null);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/ai-knowledge');
            const data = await res.json();
            const arr = Array.isArray(data) ? data : [];
            // Identificar promociones por keyword 'promocion'
            setItems(arr.filter(i => (i.keywords || []).includes('promocion')));
        } catch (error) {
            console.error('Error fetching promociones:', error);
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar esta promoción?')) return;
        try {
            await apiFetch(`/api/ai-knowledge/${id}`, { method: 'DELETE' });
            setItems(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            console.error('Error deleting promocion:', error);
        }
    };

    const handleToggleActive = async (item) => {
        try {
            const formData = new FormData();
            formData.append('title', item.title || '');
            formData.append('content', item.content || '');
            formData.append('active', item.active ? 'false' : 'true');
            formData.append('keywords', (item.keywords || []).join(', '));
            if (item.media_url) formData.append('media_url', item.media_url);

            const res = await apiFetch(`/api/ai-knowledge/${item.id}`, { method: 'PUT', body: formData });
            if (res.ok) {
                const updated = await res.json();
                setItems(prev => prev.map(p => p.id === item.id ? updated : p));
            }
        } catch (err) {
            console.error('Error toggling active:', err);
        }
    };

    const handleSuccess = (item) => {
        setItems(prev => {
            const index = prev.findIndex(c => c.id === item.id);
            if (index !== -1) { const next = [...prev]; next[index] = item; return next; }
            // Solo agregar si tiene keyword 'promocion'
            if ((item.keywords || []).includes('promocion')) return [item, ...prev];
            return prev;
        });
        setShowModal(false);
    };

    const filteredItems = items.filter(c =>
        (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.content || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeCount = items.filter(i => i.active !== false).length;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Summary pills */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '10px', backgroundColor: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: '0.85rem', border: '1px solid #bbf7d0' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }} />
                    {activeCount} activa{activeCount !== 1 ? 's' : ''}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '10px', backgroundColor: '#f9fafb', color: '#6b7280', fontWeight: 600, fontSize: '0.85rem', border: '1px solid #e5e7eb' }}>
                    {items.length - activeCount} inactiva{(items.length - activeCount) !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                    <Search className="w-5 h-5" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                        type="text"
                        placeholder="Buscar promociones..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: '14px', border: '1.5px solid #e5e7eb', fontSize: '0.95rem', outline: 'none', backgroundColor: '#f9fafb' }}
                        onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.backgroundColor = 'white'; }}
                        onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.backgroundColor = '#f9fafb'; }}
                    />
                </div>
                <button
                    className="btn"
                    onClick={() => { setSelected(null); setShowModal(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 24px', borderRadius: '14px', backgroundColor: 'var(--color-primary)', color: 'white', fontWeight: 600, fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(18,140,126,0.25)', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                    <Plus className="w-5 h-5" />
                    <span>Nueva Promoción</span>
                </button>
            </div>

            {/* Grid de tarjetas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '20px', paddingBottom: '20px' }}>
                {loading ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px 0' }}>
                        <div className="loading-spinner" />
                        <p style={{ color: '#6b7280', marginTop: '16px' }}>Cargando promociones...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px 40px', backgroundColor: '#f9fafb', borderRadius: '24px', border: '2px dashed #e2e8f0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📣</div>
                        <h4 style={{ color: '#111827', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0' }}>Sin promociones</h4>
                        <p style={{ color: '#6b7280', margin: 0 }}>
                            {searchQuery ? 'No hay resultados.' : 'Crea promociones para que la IA las comparta con los clientes.'}
                        </p>
                        {!searchQuery && (
                            <button className="btn" onClick={() => { setSelected(null); setShowModal(true); }}
                                style={{ marginTop: '24px', color: 'var(--color-primary)', fontWeight: 700, background: 'white', border: '1.5px solid var(--color-primary)', padding: '10px 20px', borderRadius: '12px' }}>
                                Crear primera promoción
                            </button>
                        )}
                    </div>
                ) : (
                    filteredItems.map(item => {
                        const isActive = item.active !== false;
                        // Calcular URL de imagen
                        const imgSrc = item.media_url
                            ? (item.media_url.startsWith('http') ? item.media_url : `${API_URL}${item.media_url}`)
                            : (item.full_url || null);

                        return (
                            <div key={item.id} style={{
                                border: `1.5px solid ${isActive ? '#bbf7d0' : '#e5e7eb'}`,
                                borderRadius: '20px', backgroundColor: 'white',
                                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                                transition: 'all 0.3s ease'
                            }}
                                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                                {/* Imagen (si existe) */}
                                {imgSrc ? (
                                    <div style={{ height: '150px', overflow: 'hidden', position: 'relative' }}>
                                        <img src={imgSrc} alt={item.title}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={e => { e.target.parentElement.style.display = 'none'; }}
                                        />
                                        {/* Badge activo sobre imagen */}
                                        <span style={{
                                            position: 'absolute', top: '10px', left: '10px',
                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                            padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700,
                                            backgroundColor: isActive ? 'rgba(240,253,244,0.95)' : 'rgba(249,250,251,0.95)',
                                            color: isActive ? '#16a34a' : '#6b7280',
                                            border: `1px solid ${isActive ? '#bbf7d0' : '#e5e7eb'}`,
                                            backdropFilter: 'blur(4px)'
                                        }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isActive ? '#16a34a' : '#9ca3af', display: 'inline-block' }} />
                                            {isActive ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </div>
                                ) : (
                                    /* Franja de color cuando no hay imagen */
                                    <div style={{ height: '6px', backgroundColor: isActive ? '#16a34a' : '#d1d5db' }} />
                                )}

                                {/* Cuerpo */}
                                <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                        <h4 style={{ fontWeight: 700, fontSize: '1rem', margin: 0, color: '#111827', flex: 1 }}>
                                            {item.title || 'Promoción sin nombre'}
                                        </h4>
                                        {/* Toggle activo/inactivo */}
                                        <button
                                            onClick={() => handleToggleActive(item)}
                                            title={isActive ? 'Desactivar' : 'Activar'}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: isActive ? '#16a34a' : '#9ca3af', flexShrink: 0 }}
                                        >
                                            {isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                        </button>
                                    </div>

                                    {/* Badge de estado (solo cuando no hay imagen arriba) */}
                                    {!imgSrc && (
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                            padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                                            backgroundColor: isActive ? '#f0fdf4' : '#f9fafb',
                                            color: isActive ? '#16a34a' : '#6b7280',
                                            border: `1px solid ${isActive ? '#bbf7d0' : '#e5e7eb'}`,
                                            width: 'fit-content'
                                        }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isActive ? '#16a34a' : '#9ca3af', display: 'inline-block' }} />
                                            {isActive ? 'Activa' : 'Inactiva'}
                                        </span>
                                    )}

                                    <p style={{ color: '#4b5563', fontSize: '0.9rem', lineHeight: '1.6', margin: 0, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {item.content || 'Sin texto de promoción'}
                                    </p>
                                </div>

                                {/* Acciones */}
                                <div style={{ padding: '12px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button className="btn-icon" onClick={() => { setSelected(item); setShowModal(true); }}
                                        style={{ color: '#4b5563', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '10px' }} title="Editar">
                                        <Edit2 size={15} />
                                    </button>
                                    <button className="btn-icon" onClick={() => handleDelete(item.id)}
                                        style={{ color: '#ef4444', padding: '8px', backgroundColor: '#fee2e2', borderRadius: '10px' }} title="Eliminar">
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <PromocionModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                item={selected}
                onSuccess={handleSuccess}
            />
        </div>
    );
};

export default PromocionesManager;
