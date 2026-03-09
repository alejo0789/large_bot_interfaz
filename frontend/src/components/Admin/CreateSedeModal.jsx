import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
    PlusCircle, X, AlertCircle, Check, RotateCw, Wifi,
    QrCode, Zap, Users, Link2, CheckCircle2, Circle,
    ArrowRight, RefreshCw
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');

const getBackendUrl = () => {
    if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
    if (process.env.NODE_ENV === 'production') return window.location.origin;
    return 'http://localhost:4000';
};

// ─── Flujo en 2 fases distintas ─────────────────────────────────────────────
// FASE A: Formulario + Setup (hasta mostrar QR)
// FASE B: Esperar QR → luego Crear sede + Sincronizar

const CreateSedeModal = ({ onClose, onCreated, showToast }) => {
    const { token } = useAuth();

    // ── Estado del formulario ──
    const [form, setForm] = useState({
        name: '', slug: '', dbUrl: '', evolutionInstance: '', n8nWebhookUrl: '',
        whatsappProvider: 'evolution', waPhoneNumberId: '', waAccessToken: '', waVerifyToken: ''
    });
    const [testStatus, setTestStatus] = useState(null);
    const [testMsg, setTestMsg] = useState('');

    // ── Estado de las fases ──
    // 'form' | 'setup_running' | 'await_qr' | 'finish_running' | 'done'
    const [phase, setPhase] = useState('form');
    const [error, setError] = useState(null);
    const [qrCode, setQrCode] = useState(null);
    const [webhookUrl, setWebhookUrl] = useState('');

    // Estado de pasos visuales de la fase de setup
    const [setupSteps, setSetupSteps] = useState({
        db: 'pending', instance: 'pending', webhook: 'pending', qr: 'pending'
    });

    // Estado de pasos visuales de la fase final
    const [finishSteps, setFinishSteps] = useState({
        sede: 'pending', sync: 'pending'
    });

    const [syncResult, setSyncResult] = useState(null);
    const [createdTenant, setCreatedTenant] = useState(null);

    // Polling para detectar si la instancia ya está conectada
    const [isConnected, setIsConnected] = useState(false);
    const [connChecking, setConnChecking] = useState(false);
    const [connState, setConnState] = useState('');
    const pollRef = useRef(null);

    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    const markSetup = (id, status) =>
        setSetupSteps(prev => ({ ...prev, [id]: status }));
    const markFinish = (id, status) =>
        setFinishSteps(prev => ({ ...prev, [id]: status }));

    // ─── Auto-generar slug e instancia ───────────────────────────────────────
    const handleNameChange = (val) => {
        const slug = val.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim().replace(/\s+/g, '-');
        setForm(f => ({
            ...f, name: val, slug,
            evolutionInstance: `large_${slug.replace(/-/g, '_')}`
        }));
    };

    const handleTestConnection = async () => {
        if (!form.dbUrl) return;
        setTestStatus('testing'); setTestMsg('');
        try {
            const res = await fetch(`${API_URL}/api/admin/tenants/test-connection`, {
                method: 'POST', headers: authHeaders,
                body: JSON.stringify({ dbUrl: form.dbUrl })
            });
            const data = await res.json();
            if (data.success) { setTestStatus('ok'); setTestMsg('Conexión exitosa'); }
            else { setTestStatus('error'); setTestMsg(data.error || 'Error al conectar'); }
        } catch {
            setTestStatus('error'); setTestMsg('Error de red');
        }
    };

    // ─── FASE A: Setup (DB + instancia + webhook + QR) ───────────────────────
    const handleSetup = async (e) => {
        e.preventDefault();
        setError(null);
        setPhase('setup_running');
        setSetupSteps({ db: 'pending', instance: 'pending', webhook: 'pending', qr: 'pending' });
        const backendUrl = getBackendUrl();

        try {
            // Paso 1: Verificar DB
            markSetup('db', 'running');
            const dbRes = await fetch(`${API_URL}/api/admin/tenants/test-connection`, {
                method: 'POST', headers: authHeaders,
                body: JSON.stringify({ dbUrl: form.dbUrl })
            });
            const dbData = await dbRes.json();
            if (!dbData.success) throw new Error(`Error DB: ${dbData.error}`);
            markSetup('db', 'ok');

            if (form.whatsappProvider === 'official') {
                // Skip Evolution API setup
                setPhase('finish_running');
                handleFinishSetup();
                return;
            }

            // Paso 2+3: Crear instancia + configurar webhook
            markSetup('instance', 'running');
            const setupRes = await fetch(`${API_URL}/api/admin/tenants/evolution/setup`, {
                method: 'POST', headers: authHeaders,
                body: JSON.stringify({ instanceName: form.evolutionInstance, webhookBaseUrl: backendUrl })
            });
            const setupData = await setupRes.json();
            if (!setupRes.ok) throw new Error(setupData.error || 'Error al crear instancia Evolution');
            markSetup('instance', 'ok');
            markSetup('webhook', setupData.webhookConfigured ? 'ok' : 'error');

            // Guardar webhook URL para mostrar
            setWebhookUrl(setupData.webhookUrl || `${backendUrl}/evolution`);

            // Paso 4: Obtener QR
            markSetup('qr', 'running');

            // FIX: usar setupData.qr (no qrData que no existe)
            const qrInfo = setupData.qr;

            if (qrInfo?.base64) {
                setQrCode(qrInfo.base64);
                markSetup('qr', 'ok');
                setPhase('await_qr');
            } else if (qrInfo?.code === 'CONNECTED') {
                // Ya está conectada (reconexión)
                markSetup('qr', 'ok');
                setIsConnected(true);
                setPhase('await_qr');
            } else {
                // Intentar obtener QR separadamente
                const qrRes = await fetch(
                    `${API_URL}/api/admin/tenants/evolution/qr/${form.evolutionInstance}`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                const qrData = await qrRes.json();
                if (qrData.success && qrData.qr?.base64) {
                    setQrCode(qrData.qr.base64);
                    markSetup('qr', 'ok');
                    setPhase('await_qr');
                } else if (qrData.qr?.code === 'CONNECTED') {
                    markSetup('qr', 'ok');
                    setIsConnected(true);
                    setPhase('await_qr');
                } else {
                    markSetup('qr', 'error');
                    // Continuar de todos modos — quizás ya estaba conectado
                    setPhase('await_qr');
                }
            }
        } catch (err) {
            setError(err.message);
            setPhase('form');
        }
    };

    // ─── Polling para detectar conexión ──────────────────────────────────────
    const checkConnection = async () => {
        setConnChecking(true);
        try {
            const res = await fetch(
                `${API_URL}/api/admin/tenants/evolution/status/${form.evolutionInstance}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const data = await res.json();
            setConnState(data.state || '');
            if (data.connected) {
                setIsConnected(true);
                clearInterval(pollRef.current);
            }
        } catch { }
        finally { setConnChecking(false); }
    };

    // Iniciar polling automático al entrar en fase await_qr
    useEffect(() => {
        if (phase === 'await_qr' && !isConnected) {
            checkConnection();
            pollRef.current = setInterval(checkConnection, 5000);
        }
        return () => clearInterval(pollRef.current);
    }, [phase]); // eslint-disable-line

    // Detener polling cuando se conecta
    useEffect(() => {
        if (isConnected) clearInterval(pollRef.current);
    }, [isConnected]);

    // ─── FASE B: Crear sede + Sincronizar ────────────────────────────────────
    const handleFinishSetup = async () => {
        setError(null);
        setPhase('finish_running');
        setFinishSteps({ sede: 'pending', sync: 'pending' });

        try {
            // Paso 5: Crear sede en BD maestra (esto también aplica el schema)
            markFinish('sede', 'running');
            const sedeRes = await fetch(`${API_URL}/api/admin/tenants`, {
                method: 'POST', headers: authHeaders,
                body: JSON.stringify(form)
            });
            const sedeData = await sedeRes.json();
            if (!sedeRes.ok) throw new Error(sedeData.error || 'Error al registrar la sede');
            markFinish('sede', 'ok');
            setCreatedTenant(sedeData.tenant);

            // Paso 6: Sincronizar conversaciones históricas
            markFinish('sync', 'running');
            try {
                const syncRes = await fetch(
                    `${API_URL}/api/admin/tenants/${form.slug}/sync-conversations`,
                    { method: 'POST', headers: authHeaders }
                );
                const syncData = await syncRes.json();
                if (syncData.success) {
                    markFinish('sync', 'ok');
                    setSyncResult(syncData);
                } else {
                    markFinish('sync', 'error');
                    setSyncResult({ error: syncData.error || 'Sin chats disponibles aún' });
                }
            } catch (syncErr) {
                markFinish('sync', 'error');
                setSyncResult({ error: syncErr.message });
            }

            setPhase('done');
            if (showToast) showToast(`Sede "${form.name}" creada exitosamente`, 'success');
        } catch (err) {
            setError(err.message);
            setPhase('await_qr'); // Volver al QR screen con el error
        }
    };

    const handleFinish = () => {
        if (createdTenant) onCreated(createdTenant);
        onClose();
    };

    // ─── Helpers de UI ───────────────────────────────────────────────────────
    const inputStyle = {
        width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
        borderRadius: '8px', fontSize: '14px', outline: 'none',
        boxSizing: 'border-box', background: 'white', minWidth: 0
    };
    const labelStyle = {
        display: 'block', fontSize: '13px', fontWeight: '600',
        color: '#374151', marginBottom: '5px'
    };

    const StepRow = ({ label, status, detail }) => {
        const colors = {
            pending: { bg: '#f1f5f9', text: '#94a3b8', border: '#e2e8f0' },
            running: { bg: '#eff6ff', text: '#3b82f6', border: '#bfdbfe' },
            ok: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
            error: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
        };
        const c = colors[status] || colors.pending;
        return (
            <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 14px', borderRadius: '10px',
                backgroundColor: c.bg, border: `1px solid ${c.border}`,
                transition: 'all 0.3s ease'
            }}>
                <div style={{ color: c.text, flexShrink: 0 }}>
                    {status === 'running' ? <RotateCw size={17} style={{ animation: 'spin 1s linear infinite' }} />
                        : status === 'ok' ? <CheckCircle2 size={17} />
                            : status === 'error' ? <AlertCircle size={17} />
                                : <Circle size={17} />}
                </div>
                <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: c.text }}>{label}</span>
                    {detail && <div style={{ fontSize: '11px', color: c.text, marginTop: '1px', opacity: 0.8 }}>{detail}</div>}
                </div>
                {status === 'running' && <span style={{ fontSize: '11px', color: c.text }}>En proceso...</span>}
                {status === 'ok' && <span style={{ fontSize: '11px', color: c.text }}>✓</span>}
                {status === 'error' && <span style={{ fontSize: '11px', color: c.text }}>No crítico</span>}
            </div>
        );
    };

    const titles = {
        form: 'Nueva Sede',
        setup_running: 'Configurando...',
        await_qr: 'Vincula WhatsApp',
        finish_running: 'Creando sede...',
        done: '✅ Sede creada',
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}
            onClick={phase === 'form' ? onClose : undefined}
        >
            <div
                style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg,#064e3b,#059669)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <PlusCircle size={20} />
                        <span style={{ fontWeight: 700, fontSize: '17px' }}>{titles[phase] || 'Nueva Sede'}</span>
                    </div>
                    {phase === 'form' && (
                        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: 'white' }}>
                            <X size={18} />
                        </button>
                    )}
                </div>

                <div style={{ overflowY: 'auto', flex: 1 }}>
                    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* ══ FASE: FORM ════════════════════════════════════════ */}
                        {phase === 'form' && (
                            <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {error && (
                                    <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', color: '#b91c1c', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <AlertCircle size={15} />{error}
                                    </div>
                                )}

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

                                {/* URL BD */}
                                <div>
                                    <label style={labelStyle}>URL de base de datos *</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px', flex: 1 }}
                                            value={form.dbUrl}
                                            onChange={e => { setForm(f => ({ ...f, dbUrl: e.target.value })); setTestStatus(null); }}
                                            placeholder="postgresql://user:pass@host/dbname?sslmode=require"
                                        />
                                        <button type="button" onClick={handleTestConnection} disabled={!form.dbUrl || testStatus === 'testing'}
                                            style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                                            {testStatus === 'testing' ? <RotateCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Wifi size={14} />}
                                            Probar
                                        </button>
                                    </div>
                                    {testStatus && (
                                        <div style={{ marginTop: '6px', fontSize: '12px', color: testStatus === 'ok' ? '#059669' : '#dc2626', fontWeight: 600 }}>
                                            {testMsg}
                                        </div>
                                    )}
                                </div>

                                {/* Proveedor de WhatsApp */}
                                <div>
                                    <label style={labelStyle}>Proveedor de WhatsApp *</label>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                                            <input type="radio" name="provider" value="evolution" checked={form.whatsappProvider === 'evolution'} onChange={() => setForm(f => ({ ...f, whatsappProvider: 'evolution' }))} />
                                            Evolution API
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                                            <input type="radio" name="provider" value="official" checked={form.whatsappProvider === 'official'} onChange={() => setForm(f => ({ ...f, whatsappProvider: 'official' }))} />
                                            WhatsApp Oficial (Cloud API)
                                        </label>
                                    </div>
                                </div>

                                {/* Instancia Evolution O Cloud API */}
                                {form.whatsappProvider === 'evolution' ? (
                                    <div>
                                        <label style={labelStyle}>Nombre de instancia Evolution</label>
                                        <input style={{ ...inputStyle, fontFamily: 'monospace', background: '#f8fafc' }}
                                            value={form.evolutionInstance}
                                            onChange={e => setForm(f => ({ ...f, evolutionInstance: e.target.value }))}
                                            placeholder="large_cali_centro" />
                                        <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0' }}>
                                            Se genera automáticamente. El webhook se configurará solo.
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                        <div>
                                            <label style={labelStyle}>Phone Number ID *</label>
                                            <input style={inputStyle} value={form.waPhoneNumberId} onChange={e => setForm(f => ({ ...f, waPhoneNumberId: e.target.value }))} placeholder="Ej: 153xxxxxxxxx" required={form.whatsappProvider === 'official'} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Access Token (Permanente/Temporal) *</label>
                                            <input type="password" style={inputStyle} value={form.waAccessToken} onChange={e => setForm(f => ({ ...f, waAccessToken: e.target.value }))} placeholder="EAALv..." required={form.whatsappProvider === 'official'} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Webhook Verify Token *</label>
                                            <input style={inputStyle} value={form.waVerifyToken} onChange={e => setForm(f => ({ ...f, waVerifyToken: e.target.value }))} placeholder="Tu token secreto" required={form.whatsappProvider === 'official'} />
                                            <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0' }}>
                                                Usa este token en el dashboard de Meta junto con la URL: <b style={{ userSelect: 'all' }}>{getBackendUrl()}/webhook/meta</b>
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* n8n */}
                                <div>
                                    <label style={labelStyle}>n8n Webhook URL (opcional)</label>
                                    <input style={inputStyle} value={form.n8nWebhookUrl}
                                        onChange={e => setForm(f => ({ ...f, n8nWebhookUrl: e.target.value }))} placeholder="https://..." />
                                </div>

                                {/* Info box */}
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 16px' }}>
                                    <p style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: '13px', color: '#15803d' }}>🚀 Pasos automáticos al continuar:</p>
                                    <div style={{ fontSize: '12px', color: '#166534', lineHeight: '1.9' }}>
                                        <b>Fase 1:</b> Verificar DB {form.whatsappProvider === 'evolution' ? '→ Crear instancia → Configurar webhook → Mostrar QR' : ''}<br />
                                        <b>Fase 2:</b> {form.whatsappProvider === 'evolution' ? '(después de escanear) → ' : ''}Crear sede + schema → Sincronizar chats
                                    </div>
                                </div>

                                <button type="submit" disabled={!form.name || !form.dbUrl || testStatus !== 'ok'}
                                    style={{
                                        background: testStatus === 'ok' ? 'linear-gradient(135deg,#064e3b,#059669)' : '#e5e7eb',
                                        color: testStatus === 'ok' ? 'white' : '#9ca3af',
                                        border: 'none', padding: '13px 24px', borderRadius: '10px',
                                        fontWeight: 700, fontSize: '15px', cursor: testStatus === 'ok' ? 'pointer' : 'not-allowed',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%'
                                    }}>
                                    <Zap size={18} />
                                    {form.whatsappProvider === 'evolution' ? 'Configurar instancia y continuar' : 'Crear sede directamente'}
                                </button>
                            </form>
                        )}

                        {/* ══ FASE: SETUP RUNNING ═══════════════════════════════ */}
                        {phase === 'setup_running' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <StepRow label="Verificar base de datos" status={setupSteps.db} />
                                <StepRow label="Crear instancia Evolution" status={setupSteps.instance} />
                                <StepRow label="Configurar webhook automático" status={setupSteps.webhook}
                                    detail={setupSteps.webhook === 'error' ? 'Configura manualmente si es necesario' : undefined} />
                                <StepRow label="Obtener código QR" status={setupSteps.qr} />
                            </div>
                        )}

                        {/* ══ FASE: AWAIT QR ════════════════════════════════════ */}
                        {phase === 'await_qr' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                {/* Resumen del setup */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <StepRow label="Verificar base de datos" status={setupSteps.db} />
                                    <StepRow label="Instancia Evolution" status={setupSteps.instance} />
                                    <StepRow label="Webhook configurado" status={setupSteps.webhook}
                                        detail={webhookUrl || undefined} />
                                </div>

                                <div style={{ height: '1px', background: '#e5e7eb' }} />

                                {/* QR / Estado de conexión */}
                                {!isConnected ? (
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ margin: '0 0 12px 0', fontWeight: 700, fontSize: '15px', color: '#111827' }}>
                                            📱 Escanea el QR con WhatsApp
                                        </p>
                                        <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#64748b' }}>
                                            WhatsApp → <b>Dispositivos vinculados</b> → <b>Vincular un dispositivo</b>
                                        </p>

                                        {qrCode ? (
                                            <div style={{ display: 'inline-block', background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '2px solid #e2e8f0', marginBottom: '16px' }}>
                                                <img src={qrCode} alt="QR WhatsApp" style={{ width: '220px', height: '220px', display: 'block' }} />
                                            </div>
                                        ) : (
                                            <div style={{ width: '220px', height: '220px', background: '#f1f5f9', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '2px dashed #cbd5e1' }}>
                                                <QrCode size={40} color="#94a3b8" />
                                                <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>QR no disponible</p>
                                            </div>
                                        )}

                                        {/* Estado de conexión (polling) */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: '#fefce8', border: '1px solid #fde68a', marginBottom: '12px', fontSize: '13px', color: '#92400e' }}>
                                            {connChecking
                                                ? <RotateCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                                : <RefreshCw size={14} />}
                                            <span>
                                                {connChecking ? 'Verificando conexión...' : `Esperando escaneo${connState ? ` (${connState})` : ''}...`}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                            <button onClick={checkConnection} disabled={connChecking}
                                                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <RefreshCw size={13} /> Actualizar QR
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // WhatsApp conectado → mostrar botón para continuar
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ width: '72px', height: '72px', background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', border: '2px solid #bbf7d0' }}>
                                            <CheckCircle2 size={36} color="#16a34a" />
                                        </div>
                                        <p style={{ fontWeight: 700, fontSize: '16px', color: '#15803d', margin: '0 0 6px 0' }}>
                                            ¡WhatsApp conectado!
                                        </p>
                                        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
                                            Ahora crearemos la sede en el sistema y sincronizaremos las conversaciones históricas.
                                        </p>
                                    </div>
                                )}

                                {error && (
                                    <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', color: '#b91c1c', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                        <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <button
                                    onClick={handleFinishSetup}
                                    disabled={!isConnected}
                                    style={{
                                        background: isConnected ? 'linear-gradient(135deg,#064e3b,#059669)' : '#e5e7eb',
                                        color: isConnected ? 'white' : '#9ca3af',
                                        border: 'none', padding: '13px 24px', borderRadius: '10px',
                                        fontWeight: 700, fontSize: '15px',
                                        cursor: isConnected ? 'pointer' : 'not-allowed',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%'
                                    }}>
                                    <ArrowRight size={18} />
                                    {isConnected ? 'Crear sede y sincronizar conversaciones' : 'Esperando conexión de WhatsApp...'}
                                </button>
                            </div>
                        )}

                        {/* ══ FASE: FINISH RUNNING ══════════════════════════════ */}
                        {phase === 'finish_running' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <StepRow label="Crear sede y aplicar schema de BD" status={finishSteps.sede} />
                                <StepRow label="Sincronizar conversaciones históricas" status={finishSteps.sync} />
                            </div>
                        )}

                        {/* ══ FASE: DONE ════════════════════════════════════════ */}
                        {phase === 'done' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <StepRow label="Sede creada y schema aplicado" status="ok" />
                                <StepRow label="Sincronización de conversaciones" status={finishSteps.sync} />

                                {syncResult && (
                                    <div style={{
                                        background: syncResult.error ? '#fef2f2' : '#f0fdf4',
                                        border: `1px solid ${syncResult.error ? '#fecaca' : '#bbf7d0'}`,
                                        borderRadius: '10px', padding: '12px 16px'
                                    }}>
                                        {syncResult.error ? (
                                            <p style={{ margin: 0, fontSize: '13px', color: '#dc2626' }}>
                                                ⚠️ {syncResult.error}. Puedes re-sincronizar desde el panel de administración.
                                            </p>
                                        ) : (
                                            <p style={{ margin: 0, fontSize: '13px', color: '#15803d', fontWeight: 600 }}>
                                                ✅ {syncResult.imported} conversaciones importadas
                                                {syncResult.skipped > 0 ? ` · ${syncResult.skipped} omitidas` : ''}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <button onClick={handleFinish}
                                    style={{ background: 'linear-gradient(135deg,#064e3b,#059669)', color: 'white', border: 'none', padding: '13px 24px', borderRadius: '10px', fontWeight: 700, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%' }}>
                                    <Check size={18} /> Finalizar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default CreateSedeModal;
