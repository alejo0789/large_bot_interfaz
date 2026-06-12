import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink, Search, X, CheckCircle, Clock, XCircle, Image, FileText, Send, ChevronRight } from 'lucide-react';
import apiFetch from '../../utils/api';

const API_META_URL = 'https://business.facebook.com/wa/manage/message-templates/';

// ─── Status helpers ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    APPROVED: { label: 'Aprobada', color: '#15803d', bg: '#dcfce7', icon: <CheckCircle size={11} /> },
    PENDING:  { label: 'Pendiente', color: '#92400e', bg: '#fef9c3', icon: <Clock size={11} /> },
    REJECTED: { label: 'Rechazada', color: '#b91c1c', bg: '#fee2e2', icon: <XCircle size={11} /> },
};

const CATEGORY_COLOR = {
    MARKETING: { bg: '#f3e8ff', color: '#7c3aed' },
    UTILITY:   { bg: '#dbeafe', color: '#1d4ed8' },
    AUTHENTICATION: { bg: '#fef3c7', color: '#b45309' },
};

// Extract variables like {{nombre}} from template text
function extractVars(components = []) {
    const vars = new Set();
    components.forEach(c => {
        const text = c.text || c.example?.body_text?.[0]?.join(' ') || '';
        const matches = text.match(/\{\{(\w+)\}\}/g) || [];
        matches.forEach(m => vars.add(m.replace(/\{\{|\}\}/g, '')));
    });
    return [...vars];
}

// Get preview text from components
function getBodyText(components = []) {
    const body = components.find(c => c.type === 'BODY');
    return body?.text || '';
}

function getHeaderType(components = []) {
    const header = components.find(c => c.type === 'HEADER');
    return header?.format || null; // TEXT | IMAGE | VIDEO | DOCUMENT
}

function getButtons(components = []) {
    const btn = components.find(c => c.type === 'BUTTONS');
    return btn?.buttons || [];
}

// ─── Template Card ─────────────────────────────────────────────────────────────
const TemplateCard = ({ tpl, onSelect, onBulkSend }) => {
    const status = STATUS_CONFIG[tpl.status] || STATUS_CONFIG.PENDING;
    const cat = CATEGORY_COLOR[tpl.category] || CATEGORY_COLOR.UTILITY;
    const bodyText = getBodyText(tpl.components);
    const vars = extractVars(tpl.components);
    const headerType = getHeaderType(tpl.components);

    return (
        <div
            onClick={() => onSelect(tpl)}
            style={{
                background: 'white', borderRadius: '14px', padding: '18px',
                border: '1px solid #e5e7eb', cursor: 'pointer',
                transition: 'all 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#c4b5fd'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
        >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg,#25d366,#128c7e)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 16 }}>📋</span>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', wordBreak: 'break-all' }}>{tpl.name}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{tpl.language}</div>
                    </div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: status.bg, color: status.color, flexShrink: 0 }}>
                    {status.icon} {status.label}
                </span>
            </div>

            {/* Category */}
            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: cat.bg, color: cat.color, marginBottom: 10 }}>
                {tpl.category}
            </span>

            {/* Body preview */}
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, marginBottom: 12, WebkitLineClamp: 3, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>
                {bodyText || '(Sin texto de cuerpo)'}
            </p>

            {/* Footer chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {headerType && headerType !== 'TEXT' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, fontSize: 11, background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>
                        <Image size={11} /> {headerType}
                    </span>
                )}
                {vars.length > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, fontSize: 11, background: '#f3e8ff', color: '#7c3aed', fontWeight: 600 }}>
                        <FileText size={11} /> {vars.length} variable{vars.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Action buttons */}
            {tpl.status === 'APPROVED' && (
                <button
                    onClick={e => { e.stopPropagation(); onBulkSend(tpl); }}
                    style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#25d366,#128c7e)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                    <Send size={14} /> Usar en Envío Masivo
                </button>
            )}
        </div>
    );
};

// ─── Template Preview Modal ────────────────────────────────────────────────────
const TemplatePreviewModal = ({ tpl, onClose, onBulkSend }) => {
    if (!tpl) return null;
    const status = STATUS_CONFIG[tpl.status] || STATUS_CONFIG.PENDING;
    const bodyText = getBodyText(tpl.components);
    const vars = extractVars(tpl.components);
    const buttons = getButtons(tpl.components);
    const headerComp = tpl.components?.find(c => c.type === 'HEADER');
    const footerComp = tpl.components?.find(c => c.type === 'FOOTER');

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16 }} onClick={onClose}>
            <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg,#064e3b,#059669)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 17 }}>{tpl.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>{tpl.language} · {tpl.category}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: status.bg, color: status.color }}>{status.label}</span>
                        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: 'white' }}><X size={18} /></button>
                    </div>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
                    {/* WhatsApp bubble preview */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Vista previa del mensaje</div>
                        <div style={{ background: '#e5ddd5', borderRadius: 12, padding: 16, backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'400\'%3E%3C/svg%3E")' }}>
                            <div style={{ background: 'white', borderRadius: '0 12px 12px 12px', padding: '12px 14px', maxWidth: '85%', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: buttons.length ? 8 : 0 }}>
                                {headerComp && headerComp.format === 'IMAGE' && (
                                    <div style={{ height: 100, background: '#f3f4f6', borderRadius: 8, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
                                        <Image size={28} style={{ opacity: 0.4 }} />
                                    </div>
                                )}
                                {headerComp?.format === 'TEXT' && headerComp.text && (
                                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{headerComp.text}</div>
                                )}
                                <div style={{ fontSize: 14, color: '#111827', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{bodyText}</div>
                                {footerComp?.text && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{footerComp.text}</div>}
                            </div>
                            {buttons.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '85%' }}>
                                    {buttons.map((b, i) => (
                                        <div key={i} style={{ background: 'white', borderRadius: 8, padding: '8px 14px', textAlign: 'center', fontSize: 14, color: '#128c7e', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>{b.text}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Variables */}
                    {vars.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Variables requeridas</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {vars.map(v => (
                                    <span key={v} style={{ padding: '4px 10px', background: '#f3e8ff', color: '#7c3aed', borderRadius: 999, fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>{`{{${v}}}`}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Buttons detail */}
                    {buttons.length > 0 && (
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Botones</div>
                            {buttons.map((b, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < buttons.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                                    <span style={{ fontSize: 14 }}>{b.type === 'URL' ? '🔗' : b.type === 'PHONE_NUMBER' ? '📞' : '💬'}</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{b.text}</div>
                                        <div style={{ fontSize: 11, color: '#6b7280' }}>{b.url || b.phone_number || ''}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#fafafa' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: 600 }}>Cerrar</button>
                    {tpl.status === 'APPROVED' && (
                        <button onClick={() => { onClose(); onBulkSend(tpl); }} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#25d366,#128c7e)', color: 'white', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Send size={15} /> Usar en Envío Masivo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Main WaTemplates Component ────────────────────────────────────────────────
const WaTemplates = ({ onBulkSend }) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const [phoneInfo, setPhoneInfo] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch('/api/wa-templates');
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Error cargando plantillas'); return; }
            setTemplates(data.templates || []);
            setPhoneInfo(data.phoneInfo || null);
        } catch (e) {
            setError('Error de conexión: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = templates.filter(t => {
        const matchStatus = filter === 'ALL' || t.status === filter;
        const q = search.toLowerCase();
        const matchSearch = !q || t.name.toLowerCase().includes(q) || getBodyText(t.components).toLowerCase().includes(q);
        return matchStatus && matchSearch;
    });

    const counts = {
        ALL: templates.length,
        APPROVED: templates.filter(t => t.status === 'APPROVED').length,
        PENDING: templates.filter(t => t.status === 'PENDING').length,
        REJECTED: templates.filter(t => t.status === 'REJECTED').length,
    };

    const filterBtns = [
        { key: 'ALL', label: 'Todas' },
        { key: 'APPROVED', label: '✓ Aprobadas' },
        { key: 'PENDING', label: '⏳ Pendientes' },
        { key: 'REJECTED', label: '✗ Rechazadas' },
    ];

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
            {/* Top bar */}
            <div style={{ padding: '20px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>
                            <span style={{ color: '#25d366' }}>Plantillas</span> de WhatsApp
                        </h1>
                        <p style={{ margin: 0, fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                            Plantillas de mensajes cargadas desde WhatsApp Business API
                            {phoneInfo && <span style={{ marginLeft: 8, color: '#059669', fontWeight: 600 }}>· {phoneInfo.verifiedName} ({phoneInfo.displayPhone})</span>}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: '1px solid #e5e7eb', background: 'white', cursor: loading ? 'wait' : 'pointer', fontWeight: 600, fontSize: 13, color: '#374151' }}>
                            <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} /> Actualizar
                        </button>
                        <a href={API_META_URL} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                            <ExternalLink size={15} /> Gestionar en Meta
                        </a>
                    </div>
                </div>
            </div>

            {/* Filters & search */}
            <div style={{ padding: '14px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar plantillas..." style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {filterBtns.map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: '7px 14px', borderRadius: 8, border: filter === f.key ? '2px solid #25d366' : '1px solid #e5e7eb', background: filter === f.key ? '#f0fdf4' : 'white', color: filter === f.key ? '#15803d' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: filter === f.key ? 700 : 500 }}>
                            {f.label} {counts[f.key] > 0 && <span style={{ marginLeft: 4, background: filter === f.key ? '#bbf7d0' : '#f3f4f6', color: filter === f.key ? '#15803d' : '#6b7280', borderRadius: 999, padding: '0 6px', fontSize: 11 }}>{counts[f.key]}</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                {error && (
                    <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 18px', color: '#b91c1c', marginBottom: 20, fontSize: 14 }}>
                        ❌ {error}
                        {error.includes('no usa la API Oficial') && <span style={{ marginLeft: 8 }}><strong>Ve a Admin → ⚙️ WhatsApp</strong> para configurar las credenciales.</span>}
                    </div>
                )}

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
                        <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} />
                        <div>Cargando plantillas desde Meta...</div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Sin plantillas</div>
                        <div style={{ fontSize: 13 }}>{search ? 'No hay resultados para tu búsqueda.' : 'No se encontraron plantillas en tu cuenta de Meta.'}</div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                        {filtered.map(tpl => (
                            <TemplateCard key={tpl.id || tpl.name} tpl={tpl} onSelect={setSelected} onBulkSend={onBulkSend} />
                        ))}
                    </div>
                )}
            </div>

            {selected && <TemplatePreviewModal tpl={selected} onClose={() => setSelected(null)} onBulkSend={onBulkSend} />}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default WaTemplates;
