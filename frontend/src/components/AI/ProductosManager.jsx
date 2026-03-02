import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Search, ShoppingBag, DollarSign } from 'lucide-react';
import ProductoModal from './ProductoModal';
import apiFetch, { API_URL } from '../../utils/api';

const ProductosManager = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selected, setSelected] = useState(null);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/ai-knowledge?type=text');
            const data = await res.json();
            const arr = Array.isArray(data) ? data : [];
            // Excluir promociones y servicios (tienen keyword específica)
            setItems(arr.filter(i => {
                const kw = i.keywords || [];
                return !kw.includes('promocion') && !kw.includes('servicio');
            }));
        } catch (error) {
            console.error('Error fetching productos:', error);
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este producto?')) return;
        try {
            await apiFetch(`/api/ai-knowledge/${id}`, { method: 'DELETE' });
            setItems(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            console.error('Error deleting producto:', error);
        }
    };

    const handleSuccess = (item) => {
        setItems(prev => {
            const index = prev.findIndex(c => c.id === item.id);
            if (index !== -1) {
                const next = [...prev];
                next[index] = item;
                return next;
            }
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
                    <Search className="w-5 h-5" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                        type="text"
                        placeholder="Buscar productos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '12px 16px 12px 44px',
                            borderRadius: '14px', border: '1.5px solid #e5e7eb',
                            fontSize: '0.95rem', outline: 'none', backgroundColor: '#f9fafb'
                        }}
                        onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.backgroundColor = 'white'; e.target.style.boxShadow = '0 0 0 4px rgba(18,140,126,0.1)'; }}
                        onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.backgroundColor = '#f9fafb'; e.target.style.boxShadow = 'none'; }}
                    />
                </div>
                <button
                    className="btn"
                    onClick={() => { setSelected(null); setShowModal(true); }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '12px 24px', borderRadius: '14px',
                        backgroundColor: 'var(--color-primary)', color: 'white',
                        fontWeight: 600, fontSize: '0.95rem',
                        boxShadow: '0 4px 12px rgba(18,140,126,0.25)',
                        border: 'none', cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(18,140,126,0.3)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(18,140,126,0.25)'; }}
                >
                    <Plus className="w-5 h-5" />
                    <span>Nuevo Producto</span>
                </button>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '20px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px 0' }}>
                        <div className="loading-spinner" />
                        <p style={{ color: '#6b7280', marginTop: '16px' }}>Cargando productos...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 40px', backgroundColor: '#f9fafb', borderRadius: '24px', border: '2px dashed #e2e8f0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🛍️</div>
                        <h4 style={{ color: '#111827', fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0' }}>Sin productos</h4>
                        <p style={{ color: '#6b7280', margin: 0 }}>
                            {searchQuery ? 'No hay resultados para tu búsqueda.' : 'Agrega productos para que la IA pueda informar sobre ellos.'}
                        </p>
                        {!searchQuery && (
                            <button
                                className="btn"
                                onClick={() => { setSelected(null); setShowModal(true); }}
                                style={{ marginTop: '24px', color: 'var(--color-primary)', fontWeight: 700, background: 'white', border: '1.5px solid var(--color-primary)', padding: '10px 20px', borderRadius: '12px' }}
                            >
                                Crear mi primer producto
                            </button>
                        )}
                    </div>
                ) : (
                    filteredItems.map(item => (
                        <div key={item.id} style={{
                            padding: '24px', border: '1.5px solid #e5e7eb', borderRadius: '20px',
                            backgroundColor: 'white', display: 'flex', justifyContent: 'space-between',
                            alignItems: 'flex-start', transition: 'all 0.3s ease'
                        }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary-light)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                    <h4 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0, color: '#111827' }}>
                                        {item.title || 'Producto sin nombre'}
                                    </h4>
                                    <span style={{
                                        fontSize: '0.7rem', backgroundColor: 'rgba(18,140,126,0.1)',
                                        color: 'var(--color-primary)', padding: '4px 10px',
                                        borderRadius: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'
                                    }}>
                                        Producto
                                    </span>
                                    {/* Precio badge */}
                                    {(item.price !== null && item.price !== undefined) && (
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            fontSize: '0.85rem', backgroundColor: '#f0fdf4',
                                            color: '#16a34a', padding: '4px 12px',
                                            borderRadius: '8px', fontWeight: 700,
                                            border: '1px solid #bbf7d0'
                                        }}>
                                            <DollarSign size={12} />
                                            {formatPrice(item.price)}
                                        </span>
                                    )}
                                </div>

                                {/* Imagen opcional */}
                                {item.media_url && (
                                    <div style={{ marginBottom: '12px' }}>
                                        <img
                                            src={item.media_url?.startsWith('http') ? item.media_url : `${API_URL}${item.media_url}`}
                                            alt={item.title}
                                            style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '10px', objectFit: 'cover', border: '2px solid #f3f4f6' }}
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    </div>
                                )}

                                <p style={{
                                    color: '#4b5563', whiteSpace: 'pre-wrap', fontSize: '0.95rem',
                                    lineHeight: '1.6', display: '-webkit-box', WebkitLineClamp: 4,
                                    WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0
                                }}>
                                    {item.content}
                                </p>

                                {item.keywords && item.keywords.length > 0 && (
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                                        {item.keywords.map((k, i) => (
                                            <span key={i} style={{ fontSize: '0.75rem', backgroundColor: '#f3f4f6', padding: '4px 12px', borderRadius: '10px', color: '#374151', fontWeight: 600, border: '1px solid #e5e7eb' }}>
                                                #{k}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginLeft: '24px', flexShrink: 0 }}>
                                <button
                                    className="btn-icon"
                                    style={{ color: '#4b5563', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '12px' }}
                                    onClick={() => { setSelected(item); setShowModal(true); }}
                                    title="Editar"
                                >
                                    <Edit2 className="w-5 h-5" />
                                </button>
                                <button
                                    className="btn-icon"
                                    style={{ color: '#ef4444', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '12px' }}
                                    onClick={() => handleDelete(item.id)}
                                    title="Eliminar"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <ProductoModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                item={selected}
                onSuccess={handleSuccess}
            />
        </div>
    );
};

export default ProductosManager;
