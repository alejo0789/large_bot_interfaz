import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import {
    Users, UserPlus, Shield, Building2, Trash2, Eye, EyeOff,
    X, Check, AlertCircle, Search, RotateCw, PlusCircle, Wifi, WifiOff
} from 'lucide-react';
import CreateSedeModal from './CreateSedeModal';

const API_URL = process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS = { SUPER_ADMIN: 'Super Admin', SEDE_ADMIN: 'Admin Sede', OPERATOR: 'Operador' };
const ROLE_COLORS = {
    SUPER_ADMIN: { bg: '#ede9fe', color: '#7c3aed' },
    SEDE_ADMIN: { bg: '#dbeafe', color: '#1d4ed8' },
    OPERATOR: { bg: '#f3f4f6', color: '#374151' },
};

const RoleBadge = ({ role }) => {
    const { bg, color } = ROLE_COLORS[role] || ROLE_COLORS.OPERATOR;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: bg, color }}>
            <Shield size={11} />{ROLE_LABELS[role] || role}
        </span>
    );
};

const StatusBadge = ({ isActive }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: isActive ? '#dcfce7' : '#fee2e2', color: isActive ? '#16a34a' : '#dc2626' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isActive ? '#16a34a' : '#dc2626' }} />
        {isActive ? 'Activo' : 'Inactivo'}
    </span>
);

const ToggleSwitch = ({ checked, onChange, disabled }) => (
    <button onClick={() => !disabled && onChange(!checked)} style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', backgroundColor: checked ? '#10b981' : '#d1d5db', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0, opacity: disabled ? 0.5 : 1 }}>
        <span style={{ position: 'absolute', top: '3px', left: checked ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
);

// ─── Create User Modal ────────────────────────────────────────────────────────
const CreateUserModal = ({ tenants, callerRole, callerTenants, currentSede, onClose, onCreated, showToast }) => {
    const { token } = useAuth();

    // SEDE_ADMIN: sede field is hidden and fixed to their own sede
    // SUPER_ADMIN: sede dropdown is shown, pre-filled from panel filter but editable
    const sedeAdminPreset = callerRole === 'SEDE_ADMIN' && callerTenants.length > 0
        ? callerTenants[0].slug : '';
    const hideSedeField = callerRole === 'SEDE_ADMIN';

    const [form, setForm] = useState({ username: '', password: '', name: '', email: '', role: 'OPERATOR', sede: sedeAdminPreset || currentSede || '' });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Keep sede in sync if currentSede changes (e.g. panel filter changes while modal is open)
    useEffect(() => {
        const initial = sedeAdminPreset || currentSede || '';
        setForm(f => ({ ...f, sede: initial }));
    }, [sedeAdminPreset, currentSede]);

    const availableSedesForCreate = callerRole === 'SUPER_ADMIN'
        ? tenants
        : tenants.filter(t => callerTenants.some(ct => ct.slug === t.slug));

    // SEDE_ADMIN can only create OPERATORs
    const availableRoles = callerRole === 'SUPER_ADMIN'
        ? [{ v: 'OPERATOR', l: 'Operador' }, { v: 'SEDE_ADMIN', l: 'Admin Sede' }, { v: 'SUPER_ADMIN', l: 'Super Admin' }]
        : [{ v: 'OPERATOR', l: 'Operador' }];

    const fixedSedeName = hideSedeField
        ? (tenants.find(t => t.slug === sedeAdminPreset)?.name || sedeAdminPreset)
        : null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Error al crear usuario'); setLoading(false); return; }
            showToast('Usuario creado exitosamente', 'success');
            onCreated(data.user);
            onClose();
        } catch {
            setError('Error de conexión');
            setLoading(false);
        }
    };

    const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: 'white', minWidth: 0 };
    const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '5px' };
    const cellStyle = { minWidth: 0, overflow: 'hidden' };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: '16px' }} onClick={onClose}>
            <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '460px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg,#1e1b4b,#4338ca)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <UserPlus size={20} />
                        <span style={{ fontWeight: 700, fontSize: '17px' }}>Nuevo Usuario</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: 'white' }}>
                        <X size={18} />
                    </button>
                </div>

                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {/* Decoy fields to prevent browser autofill */}
                    <div style={{ display: 'none' }} aria-hidden="true">
                        <input type="text" tabIndex={-1} readOnly />
                        <input type="password" tabIndex={-1} readOnly />
                    </div>

                    <form onSubmit={handleSubmit} autoComplete="off" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {error && (
                            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', color: '#b91c1c', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <AlertCircle size={15} />{error}
                            </div>
                        )}

                        {/* Nombre */}
                        <div style={cellStyle}>
                            <label style={labelStyle}>Nombre Completo *</label>
                            <input style={inputStyle} required autoComplete="off" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Ana García" />
                        </div>

                        {/* Usuario + Email */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', minWidth: 0 }}>
                            <div style={cellStyle}>
                                <label style={labelStyle}>Usuario *</label>
                                <input style={inputStyle} required autoComplete="off" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="usuario" />
                            </div>
                            <div style={cellStyle}>
                                <label style={labelStyle}>Email</label>
                                <input style={inputStyle} type="email" autoComplete="off" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" />
                            </div>
                        </div>

                        {/* Contraseña */}
                        <div style={cellStyle}>
                            <label style={labelStyle}>Contraseña *</label>
                            <div style={{ position: 'relative' }}>
                                <input style={{ ...inputStyle, paddingRight: '40px' }} type={showPass ? 'text' : 'password'} required autoComplete="new-password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mín. 6 caracteres" />
                                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '10px', top: '9px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Rol + Sede */}
                        <div style={{ display: 'grid', gridTemplateColumns: hideSedeField ? '1fr' : '1fr 1fr', gap: '12px', minWidth: 0 }}>
                            <div style={cellStyle}>
                                <label style={labelStyle}>Rol *</label>
                                <select style={inputStyle} required value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                                    {availableRoles.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                                </select>
                            </div>
                            {/* SUPER_ADMIN: dropdown editable, pre-filled from filter */}
                            {!hideSedeField && (
                                <div style={cellStyle}>
                                    <label style={labelStyle}>Sede *</label>
                                    <select style={inputStyle} required value={form.sede} onChange={e => setForm(f => ({ ...f, sede: e.target.value }))}>
                                        <option value="">-- Seleccionar --</option>
                                        {availableSedesForCreate.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* SEDE_ADMIN: read-only sede label */}
                        {hideSedeField && fixedSedeName && (
                            <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Building2 size={13} />
                                Usuario será registrado en la sede: <strong style={{ color: '#374151' }}>{fixedSedeName}</strong>
                            </div>
                        )}

                        {/* Botones */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
                                Cancelar
                            </button>
                            <button type="submit" disabled={loading} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#4f46e5,#3b82f6)', color: 'white', cursor: loading ? 'wait' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', opacity: loading ? 0.7 : 1 }}>
                                {loading ? <RotateCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={15} />}
                                {loading ? 'Creando...' : 'Crear Usuario'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// Helper: renders children into document.body to escape any scroll/overflow container
const Portal = ({ children }) => ReactDOM.createPortal(children, document.body);

// ─── AdminPanel Principal ─────────────────────────────────────────────────────
const AdminPanel = ({ isMobile }) => {
    const { user, token } = useAuth();
    const { currentTenant } = useTenant();

    const [users, setUsers] = useState([]);
    const [tenants, setTenants] = useState([]);
    // Pre-seleccionar la sede activa del contexto global
    const [selectedSede, setSelectedSede] = useState(() => currentTenant?.slug || '');
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showSedeModal, setShowSedeModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [toast, setToast] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [syncingSlug, setSyncingSlug] = useState(null);

    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const isSedeAdmin = user?.role === 'SEDE_ADMIN';

    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Cargar sedes disponibles
    useEffect(() => {
        fetch(`${API_URL}/api/admin/tenants`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.json())
            .then(data => { if (data.success) setTenants(data.tenants || []); })
            .catch(() => { });
    }, [token]);

    // Cargar usuarios
    const loadUsers = useCallback(async (sedeSlug) => {
        setLoading(true);
        try {
            const url = sedeSlug
                ? `${API_URL}/api/admin/users?sede=${encodeURIComponent(sedeSlug)}`
                : `${API_URL}/api/admin/users`;
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) setUsers(data.users || []);
        } catch { }
        finally { setLoading(false); }
    }, [token]);

    // SEDE_ADMIN: auto-seleccionar su primera sede asignada
    useEffect(() => {
        if (isSedeAdmin && user?.tenants?.length > 0 && !selectedSede) {
            setSelectedSede(user.tenants[0].slug);
        }
    }, [isSedeAdmin, user, selectedSede]);

    useEffect(() => { loadUsers(selectedSede); }, [selectedSede, loadUsers]);

    const handleToggleStatus = async (userId, currentStatus) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/users/${userId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ isActive: !currentStatus })
            });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || 'Error', 'error'); return; }
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));
            showToast(!currentStatus ? 'Usuario activado' : 'Usuario desactivado', 'success');
        } catch { showToast('Error de conexión', 'error'); }
    };

    const handleDelete = async (userId) => {
        setConfirmDelete(null);
        try {
            const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || 'Error al eliminar', 'error'); return; }
            setUsers(prev => prev.filter(u => u.id !== userId));
            showToast('Usuario eliminado', 'success');
        } catch { showToast('Error de conexión', 'error'); }
    };

    const handleSyncConversations = async (slug) => {
        setSyncingSlug(slug);
        try {
            const res = await fetch(`${API_URL}/api/admin/tenants/${slug}/sync-conversations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ ${data.imported} conversaciones sincronizadas (${data.skipped} omitidas)`, 'success');
            } else {
                showToast(data.error || 'Error sincronizando', 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        } finally {
            setSyncingSlug(null);
        }
    };

    const filteredUsers = users.filter(u => {
        const q = searchQuery.toLowerCase();
        return !q || u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    });

    const callerTenants = user?.tenants || [];

    return (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#f8fafc', padding: isMobile ? '12px' : '24px' }}>

            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, background: toast.type === 'success' ? '#10b981' : '#ef4444', color: 'white', padding: '12px 20px', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '320px' }}>
                    {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Confirmación eliminar */}
            {confirmDelete && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: '16px' }}>
                    <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '360px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '10px' }}>
                                <Trash2 size={20} color="#dc2626" />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '16px', color: '#111' }}>Eliminar usuario</div>
                                <div style={{ color: '#6b7280', fontSize: '13px' }}>Esta acción no se puede deshacer</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setConfirmDelete(null)} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                            <button onClick={() => handleDelete(confirmDelete)} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Encabezado */}
            <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ background: 'linear-gradient(135deg,#1e1b4b,#4338ca)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={22} color="white" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#111827' }}>Gestión de Usuarios</h1>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                            {isSuperAdmin ? 'Administración global de usuarios por sede' : 'Administración de tu sede'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Barra de controles */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                {/* Filtro de sede */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '180px' }}>
                    <Building2 size={16} color="#6b7280" />
                    <select value={selectedSede} onChange={e => setSelectedSede(e.target.value)} disabled={isSedeAdmin}
                        style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', outline: 'none', color: '#374151', cursor: isSedeAdmin ? 'not-allowed' : 'pointer', background: 'white', flex: 1 }}>
                        {isSuperAdmin && <option value="">Todas las sedes</option>}
                        {tenants.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}
                    </select>
                </div>

                {/* Búsqueda */}
                <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
                    <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        placeholder="Buscar usuario..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: 'white' }}
                    />
                </div>

                {/* Refrescar */}
                <button onClick={() => loadUsers(selectedSede)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 14px', background: 'white', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RotateCw size={15} />
                </button>

                {/* Nueva Sede (solo SUPER_ADMIN) */}
                {isSuperAdmin && (
                    <button onClick={() => setShowSedeModal(true)} style={{ background: 'linear-gradient(135deg,#059669,#10b981)', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                        <PlusCircle size={16} /> Nueva Sede
                    </button>
                )}

                {/* Nuevo usuario */}
                <button onClick={() => setShowCreateModal(true)} style={{ background: 'linear-gradient(135deg,#4f46e5,#3b82f6)', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
                    <UserPlus size={16} /> Nuevo Usuario
                </button>
            </div>

            {/* ── Sedes (SUPER_ADMIN only) ── */}
            {isSuperAdmin && tenants.length > 0 && (
                <div style={{ background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <Building2 size={16} color="#059669" />
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>Sedes registradas</span>
                        <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '4px' }}>({tenants.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {tenants.map(t => (
                            <div key={t.slug} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '120px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{t.name}</div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                                        {t.slug} {t.whatsapp_provider === 'official' ? '· WhatsApp Oficial' : (t.evolution_instance ? `· ${t.evolution_instance}` : '')}
                                    </div>
                                </div>
                                <StatusBadge isActive={t.is_active} />
                                <button
                                    onClick={() => handleSyncConversations(t.slug)}
                                    disabled={syncingSlug === t.slug}
                                    title="Sincronizar conversaciones históricas desde Evolution"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', cursor: syncingSlug === t.slug ? 'wait' : 'pointer', fontSize: '12px', fontWeight: 600, opacity: syncingSlug === t.slug ? 0.7 : 1 }}
                                >
                                    <RotateCw size={13} style={syncingSlug === t.slug ? { animation: 'spin 1s linear infinite' } : {}} />
                                    {syncingSlug === t.slug ? 'Sincronizando...' : 'Sincronizar chats'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabla de usuarios */}
            <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>
                        <RotateCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                        <div>Cargando usuarios...</div>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>
                        <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>Sin usuarios</div>
                        <div style={{ fontSize: '13px' }}>
                            {searchQuery ? 'No se encontraron resultados.' : 'No hay usuarios registrados en esta sede.'}
                        </div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                    {['Usuario', 'Datos', 'Rol', 'Estado', 'Acciones'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((u, idx) => (
                                    <tr key={u.id}
                                        style={{ borderBottom: idx < filteredUsers.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                    >
                                        {/* Avatar + nombre */}
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${ROLE_COLORS[u.role]?.color || '#374151'}, #3b82f6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px' }}>
                                                    {(u.name || u.username || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{u.name || '—'}</div>
                                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>@{u.username}</div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Email */}
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ fontSize: '13px', color: '#374151' }}>{u.email || '—'}</div>
                                            {u.last_login && (
                                                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                                                    Último acceso: {new Date(u.last_login).toLocaleDateString('es-CO')}
                                                </div>
                                            )}
                                        </td>

                                        {/* Rol */}
                                        <td style={{ padding: '14px 16px' }}><RoleBadge role={u.role} /></td>

                                        {/* Estado toggle */}
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <ToggleSwitch checked={u.is_active} onChange={() => handleToggleStatus(u.id, u.is_active)} disabled={u.id === user?.id} />
                                                <StatusBadge isActive={u.is_active} />
                                            </div>
                                        </td>

                                        {/* Acciones */}
                                        <td style={{ padding: '14px 16px' }}>
                                            {u.id !== user?.id ? (
                                                <button onClick={() => setConfirmDelete(u.id)} title="Eliminar usuario"
                                                    style={{ background: '#fee2e2', border: 'none', borderRadius: '7px', padding: '7px 10px', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600 }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#fecaca'}
                                                    onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}
                                                >
                                                    <Trash2 size={14} /> Eliminar
                                                </button>
                                            ) : (
                                                <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Tú</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer */}
                {!loading && filteredUsers.length > 0 && (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', fontSize: '12px', color: '#6b7280' }}>
                        {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''}
                        {searchQuery && ` (filtrados)`}
                    </div>
                )}
            </div>

            {/* Modal crear usuario */}
            {showCreateModal && (
                <Portal>
                    <CreateUserModal
                        tenants={tenants}
                        callerRole={user?.role}
                        callerTenants={callerTenants}
                        currentSede={selectedSede}
                        onClose={() => setShowCreateModal(false)}
                        onCreated={() => loadUsers(selectedSede)}
                        showToast={showToast}
                    />
                </Portal>
            )}

            {/* Modal nueva sede */}
            {showSedeModal && (
                <Portal>
                    <CreateSedeModal
                        onClose={() => setShowSedeModal(false)}
                        onCreated={(newTenant) => {
                            setTenants(prev => [...prev, newTenant]);
                            setSelectedSede(newTenant.slug);
                        }}
                        showToast={showToast}
                    />
                </Portal>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default AdminPanel;
