import React, { useState, useEffect } from 'react';
import { MapPin, Phone, CreditCard, Plus, Trash2, Save, RefreshCw, CheckCircle, HelpCircle, Sparkles, Building2 } from 'lucide-react';
import apiFetch from '../../utils/api';

const SedeInfoManager = ({ isGlobal = false }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);
    const [error, setError] = useState(null);

    // Standard fields
    const [ubicacion, setUbicacion] = useState({ 
        id: null, 
        title: isGlobal ? 'Ubicación Central / Sede Principal' : 'Ubicación y Dirección', 
        content: '', 
        sub_type: 'ubicacion' 
    });
    const [telefono, setTelefono] = useState({ 
        id: null, 
        title: isGlobal ? 'Teléfono Central / Atención Corporativa' : 'Teléfono y Contacto de la Sede', 
        content: '', 
        sub_type: 'telefono' 
    });
    const [mediosPago, setMediosPago] = useState({ 
        id: null, 
        title: isGlobal ? 'Políticas de Pago y Cuentas Corporativas' : 'Medios de Pago Aceptados', 
        content: '', 
        sub_type: 'medios_pago' 
    });

    // Custom fields list [{ id, title, content, sub_type: 'custom' }]
    const [customFields, setCustomFields] = useState([]);

    // Fetch existing sede info
    const fetchSedeInfo = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch(`/api/ai-knowledge/sede${isGlobal ? '?global=true' : ''}`);
            if (!res.ok) throw new Error('Error al cargar la información');
            const data = await res.json();

            // Reset standard fields
            let foundUbi = null;
            let foundTel = null;
            let foundPago = null;
            const extra = [];

            if (Array.isArray(data)) {
                data.forEach(item => {
                    const kw = item.keywords || [];
                    if (!isGlobal && kw.includes('ubicacion')) {
                        foundUbi = { id: item.id, title: item.title || 'Ubicación y Dirección', content: item.content || '', sub_type: 'ubicacion' };
                    } else if (!isGlobal && kw.includes('telefono')) {
                        foundTel = { id: item.id, title: item.title || 'Teléfono y Contacto de la Sede', content: item.content || '', sub_type: 'telefono' };
                    } else if (!isGlobal && kw.includes('medios_pago')) {
                        foundPago = { id: item.id, title: item.title || 'Medios de Pago Aceptados', content: item.content || '', sub_type: 'medios_pago' };
                    } else {
                        extra.push({
                            id: item.id,
                            title: item.title || '',
                            content: item.content || '',
                            sub_type: 'custom'
                        });
                    }
                });
            }

            setUbicacion(foundUbi || { id: null, title: 'Ubicación y Dirección', content: '', sub_type: 'ubicacion' });
            setTelefono(foundTel || { id: null, title: 'Teléfono y Contacto de la Sede', content: '', sub_type: 'telefono' });
            setMediosPago(foundPago || { id: null, title: 'Medios de Pago Aceptados', content: '', sub_type: 'medios_pago' });
            setCustomFields(extra);
        } catch (err) {
            console.error('Error fetching info:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSedeInfo();
    }, [isGlobal]);

    // Add new custom field
    const handleAddCustomField = () => {
        setCustomFields([
            ...customFields,
            { id: null, title: '', content: '', sub_type: 'custom' }
        ]);
    };

    // Update custom field
    const handleUpdateCustomField = (index, field, value) => {
        const updated = [...customFields];
        updated[index] = { ...updated[index], [field]: value };
        setCustomFields(updated);
    };

    // Delete a field (custom or standard)
    const handleDeleteField = async (item, index = null) => {
        if (item.id) {
            if (!window.confirm(`¿Estás seguro de eliminar el campo "${item.title || 'Información'}"?`)) return;
            try {
                const res = await apiFetch(`/api/ai-knowledge/${item.id}${isGlobal ? '?global=true' : ''}`, { method: 'DELETE' });
                if (!res.ok) throw new Error('No se pudo eliminar el campo');
            } catch (err) {
                alert('Error al eliminar: ' + err.message);
                return;
            }
        }

        if (index !== null) {
            const updated = [...customFields];
            updated.splice(index, 1);
            setCustomFields(updated);
        } else {
            if (item.sub_type === 'ubicacion') setUbicacion({ id: null, title: 'Ubicación y Dirección', content: '', sub_type: 'ubicacion' });
            if (item.sub_type === 'telefono') setTelefono({ id: null, title: 'Teléfono y Contacto de la Sede', content: '', sub_type: 'telefono' });
            if (item.sub_type === 'medios_pago') setMediosPago({ id: null, title: 'Medios de Pago Aceptados', content: '', sub_type: 'medios_pago' });
        }
    };

    // Save all fields
    const handleSaveAll = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        setError(null);
        setSavedSuccess(false);

        try {
            const itemsToSave = [];

            if (!isGlobal) {
                if (ubicacion.content.trim()) itemsToSave.push(ubicacion);
                if (telefono.content.trim()) itemsToSave.push(telefono);
                if (mediosPago.content.trim()) itemsToSave.push(mediosPago);
            }

            customFields.forEach(cf => {
                if (cf.title.trim() && cf.content.trim()) {
                    itemsToSave.push(cf);
                }
            });

            const res = await apiFetch(`/api/ai-knowledge/sede${isGlobal ? '?global=true' : ''}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: itemsToSave })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error guardando información');
            }

            setSavedSuccess(true);
            setTimeout(() => setSavedSuccess(false), 4000);
            await fetchSedeInfo();
        } catch (err) {
            console.error('Error saving info:', err);
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: '#6b7280' }}>
                <RefreshCw className="w-8 h-8 spin" style={{ animation: 'spin 1s linear infinite', marginBottom: '12px', color: '#8b5cf6' }} />
                <span>Cargando información de la sede...</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <form onSubmit={handleSaveAll} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header info */}
            <div style={{
                background: 'linear-gradient(135deg, #f3e8ff 0%, #e0e7ff 100%)',
                borderRadius: '16px',
                padding: '20px 24px',
                border: '1px solid #c084fc33',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
            }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: '#8b5cf6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                    flexShrink: 0
                }}>
                    <Building2 className="w-6 h-6" />
                </div>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#4c1d95' }}>
                        Información Institucional de la Sede
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#5b21b6' }}>
                        Toda la información registrada aquí ingresará automáticamente a la Base de Conocimiento de la IA con vectores de búsqueda para que el bot responda a tus clientes.
                    </p>
                </div>
            </div>

            {/* Notification alert */}
            {savedSuccess && (
                <div style={{
                    padding: '14px 18px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '12px',
                    color: '#15803d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                }}>
                    <CheckCircle className="w-5 h-5" />
                    ¡Información de la sede guardada y sincronizada correctamente con la IA!
                </div>
            )}

            {error && (
                <div style={{
                    padding: '14px 18px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '12px',
                    color: '#b91c1c',
                    fontSize: '0.9rem'
                }}>
                    ❌ {error}
                </div>
            )}

            {/* 1. Ubicación */}
            <div style={{
                background: 'white',
                borderRadius: '16px',
                border: '1px solid #e5e7eb',
                padding: '20px 24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <MapPin className="w-5 h-5 text-purple-600" style={{ color: '#8b5cf6' }} />
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                        1. Ubicación y Dirección
                    </h4>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '0 0 12px' }}>
                    Indica la dirección exacta, ciudad, barrio y puntos de referencia útiles para llegar.
                </p>
                <textarea
                    rows={3}
                    value={ubicacion.content}
                    onChange={(e) => setUbicacion({ ...ubicacion, content: e.target.value })}
                    placeholder="Ej. Calle 15 # 4-20, Barrio San Fernando, Cali. Frente al parque principal. Atención Lunes a Sábado de 8am a 6pm."
                    style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid #d1d5db',
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        resize: 'vertical'
                    }}
                />
            </div>

            {/* 2. Teléfono */}
            <div style={{
                background: 'white',
                borderRadius: '16px',
                border: '1px solid #e5e7eb',
                padding: '20px 24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <Phone className="w-5 h-5 text-purple-600" style={{ color: '#8b5cf6' }} />
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                        2. Teléfono y Contactos de la Sede
                    </h4>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '0 0 12px' }}>
                    Números fijos, líneas de WhatsApp, extensiones o correos de soporte de esta sede.
                </p>
                <textarea
                    rows={2}
                    value={telefono.content}
                    onChange={(e) => setTelefono({ ...telefono, content: e.target.value })}
                    placeholder="Ej. WhatsApp de atención: +57 315 340 4327. Teléfono fijo: (602) 485 0000 Ext 102."
                    style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid #d1d5db',
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        resize: 'vertical'
                    }}
                />
            </div>

            {/* 3. Medios de Pago */}
            <div style={{
                background: 'white',
                borderRadius: '16px',
                border: '1px solid #e5e7eb',
                padding: '20px 24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <CreditCard className="w-5 h-5 text-purple-600" style={{ color: '#8b5cf6' }} />
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                        3. Medios de Pago Aceptados
                    </h4>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '0 0 12px' }}>
                    Indica si aceptan Nequi, Daviplata, Transferencia Bancolombia (con número de cuenta o QR), Efectivo o Tarjetas de Crédito/Débito.
                </p>
                <textarea
                    rows={3}
                    value={mediosPago.content}
                    onChange={(e) => setMediosPago({ ...mediosPago, content: e.target.value })}
                    placeholder="Ej. Recibimos Nequi al 3153404327, Daviplata, Transferencia Bancolombia Ahorros N° 123-456789-0, Tarjetas Visa/Mastercard y Efectivo en punto de venta."
                    style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid #d1d5db',
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        resize: 'vertical'
                    }}
                />
            </div>

            {/* 4. Campos Personalizados */}
            <div style={{
                background: 'white',
                borderRadius: '16px',
                border: '1px solid #e5e7eb',
                padding: '20px 24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Sparkles className="w-5 h-5 text-purple-600" style={{ color: '#8b5cf6' }} />
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                            4. Campos Personalizados / Información Adicional
                        </h4>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddCustomField}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            border: '1px solid #8b5cf6',
                            background: '#f5f3ff',
                            color: '#7c3aed',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Plus className="w-4 h-4" /> Agregar Campo
                    </button>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '0 0 16px' }}>
                    Agrega cualquier otro dato específico de tu sede (ej: "Política de Garantía", "Servicio de Parqueadero", "Proceso de Citas", etc.).
                </p>

                {customFields.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', background: '#f9fafb', borderRadius: '12px', color: '#9ca3af', fontSize: '0.85rem' }}>
                        No has agregado campos personalizados aún. Haz clic en "Agregar Campo" para incluir más detalles para la IA.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {customFields.map((cf, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                padding: '16px',
                                background: '#f9fafb',
                                borderRadius: '12px',
                                border: '1px solid #f3f4f6'
                            }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        value={cf.title}
                                        onChange={(e) => handleUpdateCustomField(idx, 'title', e.target.value)}
                                        placeholder="Título del campo (Ej. Horario de atención)"
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid #d1d5db',
                                            fontSize: '0.88rem',
                                            fontWeight: 600
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteField(cf, idx)}
                                        style={{
                                            border: 'none',
                                            background: '#fee2e2',
                                            color: '#ef4444',
                                            borderRadius: '8px',
                                            padding: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title="Eliminar campo"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <textarea
                                    rows={2}
                                    value={cf.content}
                                    onChange={(e) => handleUpdateCustomField(idx, 'content', e.target.value)}
                                    placeholder="Detalle de la información..."
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '0.88rem',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Submit Bar */}
            <div style={{
                display: 'flex',
                justify: 'flex-end',
                gap: '12px',
                padding: '16px 0'
            }}>
                <button
                    type="submit"
                    disabled={saving}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 28px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)',
                        transition: 'all 0.2s',
                        opacity: saving ? 0.7 : 1
                    }}
                >
                    {saving ? (
                        <>
                            <RefreshCw className="w-5 h-5 spin" style={{ animation: 'spin 1s linear infinite' }} />
                            Guardando...
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5" />
                            Guardar Información de la Sede
                        </>
                    )}
                </button>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </form>
    );
};

export default SedeInfoManager;
