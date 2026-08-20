import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, ArrowLeft, Users, MessageCircle, Clock, AlertTriangle, CheckCircle, XCircle, Search, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import apiFetch from '../../utils/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `hace ${days}d`;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('es-CO', { 
        day: '2-digit', month: 'short', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });
}

function getUrgencyLevel(hours) {
    if (hours === null || hours === undefined) return null;
    if (hours < 3) return { label: '< 3h', color: '#22c55e', bg: '#f0fdf4' };
    if (hours < 6) return { label: '3-6h', color: '#eab308', bg: '#fefce8' };
    if (hours < 12) return { label: '6-12h', color: '#f97316', bg: '#fff7ed' };
    if (hours < 24) return { label: '12-24h', color: '#ef4444', bg: '#fef2f2' };
    return { label: '24h+', color: '#1f2937', bg: '#f3f4f6' };
}

// ─── Campaign Card ────────────────────────────────────────────────────────────
const CampaignCard = ({ campaign, onClick, onDelete }) => {
    const total = parseInt(campaign.total_recipients) || 0;
    const replied = parseInt(campaign.replied_count) || 0;
    const noReply = parseInt(campaign.no_reply_count) || 0;
    const pct = total > 0 ? Math.round((replied / total) * 100) : 0;

    return (
        <div 
            onClick={onClick}
            style={{ 
                background: 'white', borderRadius: 14, padding: '18px 20px',
                border: '1px solid #e5e7eb', cursor: 'pointer',
                transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                position: 'relative'
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#25d366'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>📋 {campaign.template_name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{formatDate(campaign.sent_at)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: '#15803d' }}>
                        {pct}% resp.
                    </div>
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(campaign); }}
                        style={{ border: 'none', background: '#fee2e2', color: '#ef4444', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Eliminar campaña"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 6, borderRadius: 999, background: '#f3f4f6', overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #25d366, #128c7e)', width: `${pct}%`, transition: 'width 0.5s ease' }} />
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280' }}>
                    <Users size={13} /> {total} enviados
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#15803d' }}>
                    <CheckCircle size={13} /> {replied} respondieron
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#ef4444' }}>
                    <XCircle size={13} /> {noReply} sin resp.
                </div>
            </div>
        </div>
    );
};

// ─── Recipient Row ────────────────────────────────────────────────────────────
const RecipientRow = ({ r, onOpenChat }) => {
    const urgency = getUrgencyLevel(r.hours_since_last_agent_msg);

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px', borderBottom: '1px solid #f3f4f6',
            cursor: 'pointer', transition: 'background 0.15s'
        }}
            onClick={() => onOpenChat(r.phone)}
            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            {/* Avatar */}
            <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: r.tracking_status === 'no_reply' ? '#fee2e2' : r.tracking_status === 'follow_up' ? '#fef3c7' : '#dcfce7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                color: r.tracking_status === 'no_reply' ? '#ef4444' : r.tracking_status === 'follow_up' ? '#d97706' : '#15803d',
                flexShrink: 0
            }}>
                {(r.contact_name || r.phone || '?').charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.contact_name || r.phone}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.last_message_text || r.phone}
                </div>
            </div>

            {/* Urgency badge */}
            {urgency && (
                <div style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: urgency.bg, color: urgency.color, border: `1px solid ${urgency.color}20`,
                    flexShrink: 0
                }}>
                    ⏱ {urgency.label}
                </div>
            )}

            {/* Replied time */}
            {r.replied_at && (
                <div style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>
                    {timeAgo(r.replied_at)}
                </div>
            )}

            <ExternalLink size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const BulkTracking = ({ onOpenConversation }) => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [recipients, setRecipients] = useState([]);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [activeTab, setActiveTab] = useState('no_reply');
    const [searchQ, setSearchQ] = useState('');
    const [urgencyFilter, setUrgencyFilter] = useState(null);

    // Load campaigns
    const fetchCampaigns = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/wa-templates/campaigns');
            const data = await res.json();
            setCampaigns(data.campaigns || []);
        } catch (e) {
            console.error('Error loading campaigns:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

    // Load campaign detail
    const openCampaign = async (campaign) => {
        setSelectedCampaign(campaign);
        setLoadingDetail(true);
        setActiveTab('no_reply');
        setSearchQ('');
        setUrgencyFilter(null);
        try {
            const res = await apiFetch(`/api/wa-templates/campaigns/${campaign.id}`);
            const data = await res.json();
            setRecipients(data.recipients || []);
        } catch (e) {
            console.error('Error loading campaign detail:', e);
        } finally {
            setLoadingDetail(false);
        }
    };

    const refreshDetail = async () => {
        if (!selectedCampaign) return;
        setLoadingDetail(true);
        try {
            const res = await apiFetch(`/api/wa-templates/campaigns/${selectedCampaign.id}`);
            const data = await res.json();
            setRecipients(data.recipients || []);
        } catch (_) {} finally { setLoadingDetail(false); }
    };

    const handleDeleteCampaign = async (campaign) => {
        if (!window.confirm(`¿Estás seguro de eliminar el registro de seguimiento para "${campaign.template_name}"?`)) {
            return;
        }
        try {
            const res = await apiFetch(`/api/wa-templates/campaigns/${campaign.id}`, { method: 'DELETE' });
            if (res.ok) {
                if (selectedCampaign?.id === campaign.id) {
                    setSelectedCampaign(null);
                }
                fetchCampaigns();
            }
        } catch (e) {
            console.error('Error deleting campaign:', e);
        }
    };

    const handleOpenChat = (phone) => {
        if (onOpenConversation) onOpenConversation(phone);
    };

    // Filter recipients
    const filtered = recipients.filter(r => {
        const q = searchQ.toLowerCase();
        const matchesSearch = !q || (r.contact_name || '').toLowerCase().includes(q) || (r.phone || '').includes(q);
        
        if (activeTab === 'no_reply') return r.tracking_status === 'no_reply' && matchesSearch;
        if (activeTab === 'active') return r.tracking_status === 'active' && matchesSearch;
        if (activeTab === 'follow_up') {
            const isFollowUp = r.tracking_status === 'follow_up';
            if (!isFollowUp) return false;
            if (!matchesSearch) return false;
            if (urgencyFilter === null) return true;
            const h = r.hours_since_last_agent_msg || 0;
            if (urgencyFilter === 3) return h < 3;
            if (urgencyFilter === 6) return h >= 3 && h < 6;
            if (urgencyFilter === 12) return h >= 6 && h < 12;
            if (urgencyFilter === 24) return h >= 12 && h < 24;
            if (urgencyFilter === 25) return h >= 24;
            return true;
        }
        return matchesSearch;
    });

    // Tab counts
    const noReplyCount = recipients.filter(r => r.tracking_status === 'no_reply').length;
    const activeCount = recipients.filter(r => r.tracking_status === 'active').length;
    const followUpCount = recipients.filter(r => r.tracking_status === 'follow_up').length;

    // ─── Campaign List View ───────────────────────────────────────────────────
    if (!selectedCampaign) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '18px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827' }}>
                            <span style={{ color: '#8b5cf6' }}>📊 Seguimiento</span> de Campañas
                        </h1>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>Monitorea respuestas y haz seguimiento a tus envíos masivos</p>
                    </div>
                    <button onClick={fetchCampaigns} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                        <RefreshCw size={14} /> Actualizar
                    </button>
                </div>

                {/* Campaign list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px', display: 'block' }} />
                            Cargando campañas...
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                            <BarChart3 size={48} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Sin campañas aún</div>
                            <div style={{ fontSize: 13 }}>Cuando envíes mensajes masivos desde "Masivo Oficial", aparecerán aquí para seguimiento.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 700 }}>
                            {campaigns.map(c => (
                                <CampaignCard key={c.id} campaign={c} onClick={() => openCampaign(c)} onDelete={handleDeleteCampaign} />
                            ))}
                        </div>
                    )}
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // ─── Campaign Detail View ─────────────────────────────────────────────────
    const tabs = [
        { key: 'no_reply', label: 'Sin respuesta', icon: <XCircle size={14} />, count: noReplyCount, color: '#ef4444' },
        { key: 'active', label: 'Respondieron', icon: <CheckCircle size={14} />, count: activeCount, color: '#22c55e' },
        { key: 'follow_up', label: 'Seguimiento', icon: <AlertTriangle size={14} />, count: followUpCount, color: '#f59e0b' },
    ];

    const urgencyButtons = [
        { value: 3, label: '< 3h', color: '#22c55e' },
        { value: 6, label: '3-6h', color: '#eab308' },
        { value: 12, label: '6-12h', color: '#f97316' },
        { value: 24, label: '12-24h', color: '#ef4444' },
        { value: 25, label: '24h+', color: '#1f2937' },
    ];

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '14px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <button onClick={() => { setSelectedCampaign(null); fetchCampaigns(); }} 
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
                        <ArrowLeft size={14} /> Campañas
                    </button>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>📋 {selectedCampaign.template_name}</h2>
                        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{formatDate(selectedCampaign.sent_at)} · {recipients.length} destinatarios</p>
                    </div>
                    <button onClick={refreshDetail} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151' }}>
                        <RefreshCw size={13} className={loadingDetail ? 'spinning' : ''} /> Refrescar
                    </button>
                    <button onClick={() => handleDeleteCampaign(selectedCampaign)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        <Trash2 size={13} /> Eliminar
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4 }}>
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => { setActiveTab(t.key); setUrgencyFilter(null); }}
                            style={{
                                flex: 1, padding: '10px 8px', borderRadius: 10, border: 'none',
                                background: activeTab === t.key ? `${t.color}12` : 'transparent',
                                color: activeTab === t.key ? t.color : '#6b7280',
                                fontWeight: activeTab === t.key ? 700 : 500,
                                fontSize: 13, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                borderBottom: activeTab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
                                transition: 'all 0.15s'
                            }}
                        >
                            {t.icon} {t.label}
                            <span style={{ 
                                background: activeTab === t.key ? t.color : '#e5e7eb', 
                                color: activeTab === t.key ? 'white' : '#6b7280',
                                borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700 
                            }}>
                                {t.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Urgency filter (only on follow_up tab) */}
                {activeTab === 'follow_up' && followUpCount > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        <button onClick={() => setUrgencyFilter(null)}
                            style={{
                                padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                                border: urgencyFilter === null ? '2px solid #8b5cf6' : '1px solid #e5e7eb',
                                background: urgencyFilter === null ? '#ede9fe' : 'white',
                                color: urgencyFilter === null ? '#7c3aed' : '#6b7280',
                                cursor: 'pointer'
                            }}
                        >
                            Todos
                        </button>
                        {urgencyButtons.map(u => (
                            <button key={u.value} onClick={() => setUrgencyFilter(u.value)}
                                style={{
                                    padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                                    border: urgencyFilter === u.value ? `2px solid ${u.color}` : '1px solid #e5e7eb',
                                    background: urgencyFilter === u.value ? `${u.color}15` : 'white',
                                    color: urgencyFilter === u.value ? u.color : '#6b7280',
                                    cursor: 'pointer'
                                }}
                            >
                                ⏱ {u.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Search */}
            <div style={{ padding: '10px 24px', background: 'white', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar por nombre o teléfono..."
                        style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>
            </div>

            {/* Recipients list */}
            <div style={{ flex: 1, overflowY: 'auto', background: 'white' }}>
                {loadingDetail ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px', display: 'block' }} />
                        Cargando...
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>
                        {activeTab === 'no_reply' && '🎉 ¡Todos han respondido!'}
                        {activeTab === 'active' && 'No hay conversaciones activas aún.'}
                        {activeTab === 'follow_up' && 'No hay conversaciones pendientes de seguimiento.'}
                    </div>
                ) : (
                    filtered.map(r => <RecipientRow key={r.phone} r={r} onOpenChat={handleOpenChat} />)
                )}
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .spinning { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default BulkTracking;
