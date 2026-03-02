import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Search, Wrench, DollarSign } from 'lucide-react';
import ServicioModal from './ServicioModal';
import apiFetch, { API_URL } from '../../utils/api';

const ServiciosManager = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selected, setSelected] = useState(null);

    const fetchItems = async () => {
        setLoading(true);
        try {
            // Los servicios se guardan via /upload con imagen, type='audio' era el tab anterior
            // Ahora: filtramos por keyword 'servicio' entre todos los registros
            const res = await apiFetch('/api/ai-knowledge');
            const data = await res.json();
            const arr = Array.isArray(data) ? data : [];
            // Filtrar: tienen keyword 'servicio'
            setItems(arr.filter(i => (i.keywords || []).includes('servicio')));
        } catch (error) {
            console.error('Error fetching servicios:', error);
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este servicio?')) return;
        try {
            await apiFetch(`/api/ai-knowledge/${id}`, { method: 'DELETE' });
            setItems(prev => prev.filter(c => c.id !== id));
        } catch (err) {
            console.error('Error deleting servicio:', err);
        }
    };

    const handleSuccess = (item) => {
        setItems(prev => {
            const idx = prev.findIndex(c => c.id === item.id);
            if (idx !== -1) { const n = [...prev]; n[idx] = item; return n; }
            return [item, ...prev];
        });
        setShowModal(false);
    };

    const filteredItems = items.filter(c =>
        (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.content || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatPrice = (price) => {
        if (!price && price !== 0) return null;
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(price);
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input type="text" placeholder="Buscar servicios..." value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: '14px', border: '1.5px solid #e5e7eb', fontSize: '0.95rem', outline: 'none', backgroundColor: '#f9fafb' }}
                        onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.backgroundColor = 'white'; }}
                        onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.backgroundColor = '#f9fafb'; }} />
                </div>
                <button className="btn" onClick={() => { setSelected(null); setShowModal(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 24px', borderRadius: '14px', backgroundColor: 'var(--color-primary)', color: 'white', fontWeight: 600, boxShadow: '0 4px 12px rgba(18,140,126,0.25)', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    <Plus size={18} />
                    <span>Nuevo Servicio</span>
                </button>
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '24px', paddingBottom: '20px' }}>
                {loading ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px 0' }}>
                        <div className="loading-spinner" />
                        <p style={{ color: '#6b7280', marginTop: '16px' }}>Cargando servicios...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px 40px', backgroundColor: '#f9fafb', borderRadius: '24px', border: '2px dashed #e2e8f0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔧</div>
                        <h4 style={{ color: '#111827', fontWeight: 700, margin: '0 0 8px' }}>Sin servicios</h4>
                        <p style={{ color: '#6b7280', margin: 0 }}>{searchQuery ? 'Sin resultados.' : 'Agrega servicios para que la IA los presente.'}</p>
                        {!searchQuery && (
                            <button className="btn" onClick={() => { setSelected(null); setShowModal(true); }}
                                style={{ marginTop: '24px', color: 'var(--color-primary)', fontWeight: 700, background: 'white', border: '1.5px solid var(--color-primary)', padding: '10px 20px', borderRadius: '12px' }}>
                                Crear primer servicio
                            </button>
                        )}
                    </div>
                ) : (
                    filteredItems.map(item => {
                        const imgSrc = item.media_url
                            ? (item.media_url.startsWith('http') ? item.media_url : `${API_URL}${item.media_url}`)
                            : null;
                        return (
                            <div key={item.id} style={{ border: '1.5px solid #e5e7eb', borderRadius: '20px', backgroundColor: 'white', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = 'var(--color-primary-light)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
                                {/* Imagen */}
                                <div style={{ height: '160px', backgroundColor: '#f3f4f6', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {imgSrc ? (
                                        <img src={imgSrc} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={e => { e.target.style.display = 'none'; }} />
                                    ) : (
                                        <div style={{ fontSize: '3rem', opacity: 0.4 }}>🔧</div>
                                    )}
                                    <span style={{ position: 'absolute', top: '10px', left: '10px', padding: '3px 10px', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700, color: '#4b5563' }}>
                                        SERVICIO
                                    </span>
                                    {/* Botones overlay */}
                                    <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px' }}>
                                        <button className="btn-icon" onClick={() => { setSelected(item); setShowModal(true); }}
                                            style={{ padding: '7px', backgroundColor: 'rgba(255,255,255,0.9)', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#4b5563', cursor: 'pointer' }}>
                                            <Edit2 size={13} />
                                        </button>
                                        <button className="btn-icon" onClick={() => handleDelete(item.id)}
                                            style={{ padding: '7px', backgroundColor: 'rgba(255,255,255,0.9)', border: '1px solid #fee2e2', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}>
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Info */}
                                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                        <h4 style={{ fontWeight: 700, fontSize: '1rem', margin: 0, color: '#111827' }}>
                                            {item.title || 'Servicio sin nombre'}
                                        </h4>
                                        {(item.price !== null && item.price !== undefined) && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.85rem', backgroundColor: '#f0fdf4', color: '#16a34a', padding: '3px 10px', borderRadius: '8px', fontWeight: 700, border: '1px solid #bbf7d0', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                <DollarSign size={11} />
                                                {formatPrice(item.price)}
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ color: '#6b7280', fontSize: '0.875rem', lineHeight: '1.5', margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {item.content || 'Sin descripción'}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <ServicioModal isOpen={showModal} onClose={() => setShowModal(false)} item={selected} onSuccess={handleSuccess} />
        </div>
    );
};

export default ServiciosManager;
