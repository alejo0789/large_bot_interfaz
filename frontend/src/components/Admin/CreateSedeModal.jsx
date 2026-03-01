import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { PlusCircle, X, AlertCircle, Check, RotateCw, Wifi, WifiOff, QrCode } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');

const CreateSedeModal = ({ onClose, onCreated, showToast }) => {
    const { token } = useAuth();
    const [step, setStep] = useState(1); // 1: Info/DB, 2: WhatsApp/QR
    const [form, setForm] = useState({
        name: '', slug: '', dbUrl: '', evolutionInstance: '', n8nWebhookUrl: ''
    });
    const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'ok' | 'error'
    const [testMsg, setTestMsg] = useState('');
    const [qrCode, setQrCode] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Auto-generate slug and instance name from name
    const handleNameChange = (val) => {
        const slug = val.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim().replace(/\s+/g, '-');
        setForm(f => ({
            ...f,
            name: val,
            slug,
            evolutionInstance: `large_${slug.replace(/-/g, '_')}` // Standardized instance name
        }));
    };

    const handleTestConnection = async () => {
        if (!form.dbUrl) return;
        setTestStatus('testing');
        setTestMsg('');
        try {
            const res = await fetch(`${API_URL}/api/admin/tenants/test-connection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ dbUrl: form.dbUrl })
            });
            const data = await res.json();
            if (data.success) {
                setTestStatus('ok');
                setTestMsg('Conexión exitosa');
            } else {
                setTestStatus('error');
                setTestMsg(data.error || 'Error al conectar');
            }
        } catch {
            setTestStatus('error');
            setTestMsg('Error de red');
        }
    };

    const handleCreateEvolutionInstance = async () => {
        setQrLoading(true);
        setError(null);
        try {
            // 1. Create instance
            const res = await fetch(`${API_URL}/api/admin/tenants/evolution/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ instanceName: form.evolutionInstance })
            });
            const data = await res.json();

            if (!res.ok) {
                const errorStr = (data.error || data.message || '').toLowerCase();
                if (!errorStr.includes('already exists') && !errorStr.includes('ya existe')) {
                    throw new Error(data.error || data.message || 'Error al crear instancia');
                }
            }

            // 2. Fetch QR
            const qrRes = await fetch(`${API_URL}/api/admin/tenants/evolution/qr/${form.evolutionInstance}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const qrData = await qrRes.json();

            if (qrData.success && qrData.qr?.base64) {
                setQrCode(qrData.qr.base64);
                setStep(2);
            } else if (qrData.qr?.code === 'CONNECTED') {
                showToast('Instancia ya conectada', 'info');
                setStep(2);
            } else {
                throw new Error('No se pudo obtener el código QR');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setQrLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/tenants`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Error al crear sede'); setLoading(false); return; }
            if (showToast) showToast(`Sede "${form.name}" creada exitosamente`, 'success');
            onCreated(data.tenant);
            onClose();
        } catch {
            setError('Error de conexión');
            setLoading(false);
        }
    };

    const inputStyle = {
        width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
        borderRadius: '8px', fontSize: '14px', outline: 'none',
        boxSizing: 'border-box', background: 'white', minWidth: 0
    };
    const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '5px' };

    return (
        <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}
            onClick={onClose}
        >
            <div
                style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg,#064e3b,#059669)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <PlusCircle size={20} />
                        <span style={{ fontWeight: 700, fontSize: '17px' }}>Nueva Sede</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: 'white' }}>
                        <X size={18} />
                    </button>
                </div>

                <div style={{ overflowY: 'auto', flex: 1 }}>
                    <div style={{ padding: '24px' }}>
                        {error && (
                            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', color: '#b91c1c', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                                <AlertCircle size={15} />{error}
                            </div>
                        )}

                        {step === 1 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Nombre + Slug */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={labelStyle}>Nombre de la sede *</label>
                                        <input style={inputStyle} required value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="Ej: Cali Centro" />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Slug *</label>
                                        <input style={{ ...inputStyle, fontFamily: 'monospace' }} required value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="cali-centro" />
                                    </div>
                                </div>

                                {/* URL de base de datos */}
                                <div>
                                    <label style={labelStyle}>URL de base de datos *</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px', flex: 1 }}
                                            value={form.dbUrl}
                                            onChange={e => { setForm(f => ({ ...f, dbUrl: e.target.value })); setTestStatus(null); }}
                                            placeholder="postgresql://user:pass@host/dbname?sslmode=require"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleTestConnection}
                                            disabled={!form.dbUrl || testStatus === 'testing'}
                                            style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            {testStatus === 'testing' ? <RotateCw size={14} className="animate-spin" /> : <Wifi size={14} />}
                                            Probar
                                        </button>
                                    </div>
                                    {testStatus && (
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: testStatus === 'ok' ? '#059669' : '#dc2626', fontWeight: 600 }}>
                                            {testMsg}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={labelStyle}>n8n Webhook (opcional)</label>
                                    <input style={inputStyle} value={form.n8nWebhookUrl} onChange={e => setForm(f => ({ ...f, n8nWebhookUrl: e.target.value }))} placeholder="https://..." />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                                    <button
                                        onClick={handleCreateEvolutionInstance}
                                        disabled={!form.name || !form.dbUrl || testStatus !== 'ok' || qrLoading}
                                        style={{
                                            background: 'linear-gradient(135deg,#059669,#10b981)', color: 'white',
                                            border: 'none', padding: '12px 24px', borderRadius: '10px',
                                            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                                            opacity: (!form.name || testStatus !== 'ok') ? 0.6 : 1
                                        }}
                                    >
                                        {qrLoading ? <RotateCw size={18} className="animate-spin" /> : <QrCode size={18} />}
                                        {qrLoading ? 'Creando Instancia...' : 'Conectar WhatsApp (Evolution)'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ marginBottom: '16px' }}>
                                    <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700 }}>Conecta tu WhatsApp</h3>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                                        Escanea el código QR desde WhatsApp {'>'} Dispositivos vinculados
                                    </p>
                                </div>

                                <div style={{
                                    background: '#f8fafc', padding: '20px', borderRadius: '16px',
                                    display: 'inline-block', border: '1px solid #e2e8f0', marginBottom: '20px'
                                }}>
                                    {qrCode ? (
                                        <img src={qrCode} alt="WhatsApp QR" style={{ width: '240px', height: '240px' }} />
                                    ) : (
                                        <div style={{ width: '240px', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                            <Check size={48} color="#059669" />
                                            <span style={{ marginLeft: '10px', fontWeight: 600 }}>Conectado</span>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                    <button
                                        onClick={() => setStep(1)}
                                        style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                        Atrás
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading}
                                        style={{
                                            padding: '10px 30px', borderRadius: '8px', border: 'none',
                                            background: 'linear-gradient(135deg,#064e3b,#059669)', color: 'white',
                                            cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px'
                                        }}
                                    >
                                        {loading ? <RotateCw size={18} className="animate-spin" /> : <Check size={18} />}
                                        {loading ? 'Finalizando...' : 'Finalizar y Crear Sede'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default CreateSedeModal;
