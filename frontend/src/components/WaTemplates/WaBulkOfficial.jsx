import React, { useState, useEffect, useCallback } from 'react';
import { Send, Search, Tag, Users, Image, Upload, CheckCircle, AlertCircle, X, RotateCw, ChevronDown, ChevronUp, User, Plus } from 'lucide-react';
import apiFetch from '../../utils/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractVars(components = []) {
    const vars = new Set();
    components.forEach(c => {
        const text = c.text || '';
        (text.match(/\{\{(\w+)\}\}/g) || []).forEach(m => vars.add(m.replace(/\{\{|\}\}/g, '')));
    });
    return [...vars];
}
function getBodyText(components = []) {
    return components.find(c => c.type === 'BODY')?.text || '';
}
function hasImageHeader(components = []) {
    const h = components.find(c => c.type === 'HEADER');
    return h?.format === 'IMAGE';
}
function applyVars(text, vars) {
    let result = text;
    Object.entries(vars).forEach(([k, v]) => {
        result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || `{{${k}}}`);
    });
    return result;
}

// ─── Template Selector Dropdown ───────────────────────────────────────────────
const TemplatePicker = ({ templates, loading, selected, onSelect }) => {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const filtered = templates.filter(t => t.status === 'APPROVED' && (!q || t.name.toLowerCase().includes(q)));

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, fontWeight: selected ? 700 : 400, color: selected ? '#065f46' : '#6b7280', textAlign: 'left' }}
            >
                <span>{loading ? 'Cargando plantillas...' : selected ? `📋 ${selected.name}` : 'Selecciona una plantilla aprobada...'}</span>
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {open && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                        <input value={q} onChange={e => setQ(e.target.value.toLowerCase())} placeholder="Buscar plantilla..." autoFocus style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Sin plantillas aprobadas</div>
                        ) : filtered.map(t => (
                            <button key={t.id || t.name} onClick={() => { onSelect(t); setOpen(false); setQ(''); }}
                                style={{ width: '100%', padding: '12px 16px', background: selected?.name === t.name ? '#f0fdf4' : 'white', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f9fafb' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                onMouseLeave={e => e.currentTarget.style.background = selected?.name === t.name ? '#f0fdf4' : 'white'}
                            >
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{t.name}</div>
                                    <div style={{ fontSize: 11, color: '#6b7280' }}>{t.language} · {t.category}</div>
                                </div>
                                {selected?.name === t.name && <CheckCircle size={16} color="#25d366" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Contact Panel (right side) ───────────────────────────────────────────────
const ContactPanel = ({ 
    tags, 
    conversations, 
    selectionMode, 
    setSelectionMode, 
    selectedTagId, 
    setSelectedTagId, 
    selectedPhones, 
    setSelectedPhones, 
    searchContact, 
    setSearchContact,
    importedPhones = [],
    setImportedPhones,
    importInput = '',
    setImportInput
}) => {
    const filtered = (conversations || []).filter(c => {
        const q = searchContact.toLowerCase();
        return !q || c.contact?.name?.toLowerCase().includes(q) || (c.contact?.phone || '').includes(q);
    });

    const togglePhone = phone => setSelectedPhones(prev => prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Mode tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                {[
                    ['manual', <User size={14} />, 'Contactos'],
                    ['import', <Plus size={14} />, 'Nuevo/Pegar'],
                    ['tag', <Tag size={14} />, 'Etiqueta'],
                    ['all', <Users size={14} />, 'Todos']
                ].map(([mode, icon, label]) => (
                    <button 
                        key={mode} 
                        onClick={() => setSelectionMode(mode)} 
                        style={{ 
                            flex: 1, 
                            padding: '10px 4px', 
                            border: 'none', 
                            background: selectionMode === mode ? '#f0fdf4' : 'white', 
                            color: selectionMode === mode ? '#059669' : '#6b7280', 
                            fontWeight: selectionMode === mode ? 700 : 500, 
                            fontSize: 11, 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: 3, 
                            borderBottom: selectionMode === mode ? '2px solid #25d366' : '2px solid transparent' 
                        }}
                    >
                        {icon}{label}
                    </button>
                ))}
            </div>

            {/* Tag selector */}
            {selectionMode === 'tag' && (
                <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Selecciona una etiqueta</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(tags || []).map(t => (
                            <button key={t.id} onClick={() => setSelectedTagId(t.id === selectedTagId ? null : t.id)}
                                style={{ padding: '4px 10px', borderRadius: 999, border: t.id === selectedTagId ? '2px solid #059669' : '1px solid #e5e7eb', background: t.id === selectedTagId ? '#f0fdf4' : 'white', color: t.id === selectedTagId ? '#059669' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                            >
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color || '#6b7280', display: 'inline-block' }} />
                                {t.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* All mode message */}
            {selectionMode === 'all' && (
                <div style={{ padding: 16, background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: 13, color: '#92400e', flexShrink: 0 }}>
                    ⚠️ Se enviará a <strong>todos los contactos activos</strong> de esta sede.
                </div>
            )}

            {/* Search (manual mode) */}
            {selectionMode === 'manual' && (
                <div style={{ padding: 10, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                        <input value={searchContact} onChange={e => setSearchContact(e.target.value)} placeholder="Buscar por nombre o teléfono..." style={{ width: '100%', padding: '8px 12px 8px 30px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                </div>
            )}

            {/* Contact list */}
            {selectionMode === 'manual' && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                            <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                            No se encontraron contactos
                        </div>
                    ) : filtered.map(c => {
                        const phone = c.contact?.phone || c.phone;
                        const name = c.contact?.name || c.contact_name || phone;
                        const isSelected = selectedPhones.includes(phone);
                        return (
                            <div key={phone} onClick={() => togglePhone(phone)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f9fafb', cursor: 'pointer', background: isSelected ? '#f0fdf4' : 'white' }}
                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'white'; }}
                            >
                                <div style={{ width: 18, height: 18, borderRadius: 4, border: isSelected ? 'none' : '2px solid #d1d5db', background: isSelected ? '#25d366' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {isSelected && <CheckCircle size={14} color="white" />}
                                </div>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#25d366,#128c7e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                                    {(name || '?').charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                    <div style={{ fontSize: 11, color: '#6b7280' }}>{phone}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Import / Paste list mode */}
            {selectionMode === 'import' && (
                <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Plus size={14} color="#25d366" /> Nuevo Contacto / Pegar Lista
                    </div>
                    
                    <p style={{ fontSize: 11, color: '#6b7280', margin: 0, lineHeight: 1.4 }}>
                        Ingresa un número para iniciar un chat o pega varios separados por comas, espacios o saltos de línea (ej: Excel).
                    </p>

                    <textarea
                        value={importInput}
                        onChange={(e) => {
                            const val = e.target.value;
                            setImportInput(val);
                            
                            const parsed = [];
                            const rawParts = val.split(/[,;\n\r\t]+/);
                            rawParts.forEach(part => {
                                const trimmed = part.trim();
                                if (!trimmed) return;
                                
                                const spaceParts = trimmed.split(/\s+/);
                                if (spaceParts.length > 1) {
                                    const isMultipleNumbers = spaceParts.every(sp => sp.replace(/\D/g, '').length >= 10);
                                    if (isMultipleNumbers) {
                                        spaceParts.forEach(sp => {
                                            const cleaned = sp.replace(/\D/g, '');
                                            if (cleaned.length >= 7 && cleaned.length <= 15) {
                                                parsed.push(cleaned);
                                            }
                                        });
                                        return;
                                    }
                                }
                                
                                const cleaned = trimmed.replace(/\D/g, '');
                                if (cleaned.length >= 7 && cleaned.length <= 15) {
                                    parsed.push(cleaned);
                                }
                            });
                            
                            setImportedPhones([...new Set(parsed)]);
                        }}
                        placeholder="Ej: +57 315 123 4567&#10;573001234567, 573019876543"
                        style={{
                            width: '100%',
                            height: 120,
                            padding: '8px 12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                            fontSize: 13,
                            outline: 'none',
                            boxSizing: 'border-box',
                            resize: 'vertical',
                            fontFamily: 'monospace'
                        }}
                    />

                    {importedPhones.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{importedPhones.length} número(s) detectado(s)</span>
                                <button 
                                    onClick={() => { setImportedPhones([]); setImportInput(''); }} 
                                    style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: 0 }}
                                >
                                    Limpiar
                                </button>
                            </div>
                            
                            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f8fafc', padding: '4px 8px' }}>
                                {importedPhones.map((phone, idx) => (
                                    <div key={phone} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: idx === importedPhones.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#374151' }}>{phone}</span>
                                        <button 
                                            onClick={() => {
                                                const filtered = importedPhones.filter(p => p !== phone);
                                                setImportedPhones(filtered);
                                                setImportInput(filtered.join(', '));
                                            }} 
                                            style={{ border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Footer count */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', flexShrink: 0, background: '#fafafa' }}>
                {selectionMode === 'manual' && `${selectedPhones.length} seleccionado${selectedPhones.length !== 1 ? 's' : ''} de ${filtered.length}`}
                {selectionMode === 'import' && `${importedPhones.length} número${importedPhones.length !== 1 ? 's' : ''} para enviar`}
                {selectionMode === 'tag' && selectedTagId && `Etiqueta seleccionada`}
                {selectionMode === 'all' && `Todos los contactos`}
            </div>
        </div>
    );
};

// ─── Main WaBulkOfficial Component ────────────────────────────────────────────
const WaBulkOfficial = ({ conversations, tags }) => {
    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [variables, setVariables] = useState({});
    const [headerImageUrl, setHeaderImageUrl] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [selectionMode, setSelectionMode] = useState('manual');
    const [selectedTagId, setSelectedTagId] = useState(null);
    const [selectedPhones, setSelectedPhones] = useState([]);
    const [importedPhones, setImportedPhones] = useState([]);
    const [importInput, setImportInput] = useState('');
    const [searchContact, setSearchContact] = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);
    const [stats, setStats] = useState(0);

    // Load templates and stats
    useEffect(() => {
        setLoadingTemplates(true);
        Promise.all([
            apiFetch('/api/wa-templates').then(r => r.json()).catch(() => ({})),
            apiFetch('/api/wa-templates/stats').then(r => r.json()).catch(() => ({}))
        ]).then(([templatesData, statsData]) => {
            setTemplates(templatesData.templates || []);
            setStats(statsData.currentMonthSent || 0);
        }).finally(() => setLoadingTemplates(false));
    }, []);

    // When template changes, reset variables
    useEffect(() => {
        if (!selectedTemplate) { setVariables({}); return; }
        const vars = extractVars(selectedTemplate.components || []);
        setVariables(Object.fromEntries(vars.map(v => [v, ''])));
    }, [selectedTemplate]);

    // Handle image upload
    const handleImageFile = async (file) => {
        setUploadingImage(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('folder', 'bulk');
            const res = await apiFetch('/api/upload', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.url) setHeaderImageUrl(data.url);
        } catch (e) {
            console.error('Upload error', e);
        } finally {
            setUploadingImage(false);
        }
    };

    const bodyText = selectedTemplate ? getBodyText(selectedTemplate.components || []) : '';
    const vars = selectedTemplate ? extractVars(selectedTemplate.components || []) : [];
    const needsImage = selectedTemplate ? hasImageHeader(selectedTemplate.components || []) : false;

    const canSend = selectedTemplate &&
        vars.every(v => variables[v]?.trim()) &&
        (!needsImage || headerImageUrl) &&
        (selectionMode === 'all' || 
         (selectionMode === 'tag' && selectedTagId) || 
         (selectionMode === 'manual' && selectedPhones.length > 0) ||
         (selectionMode === 'import' && importedPhones.length > 0)) &&
        !sending;

    const handleSend = async () => {
        if (!canSend) return;
        setSending(true);
        setResult(null);
        try {
            const res = await apiFetch('/api/wa-templates/bulk-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateName: selectedTemplate.name,
                    templateLanguage: selectedTemplate.language,
                    variables,
                    headerImageUrl: headerImageUrl || null,
                    selectionMode,
                    tagId: selectionMode === 'tag' ? selectedTagId : null,
                    recipients: selectionMode === 'manual' 
                        ? selectedPhones.map(p => ({ phone: p })) 
                        : selectionMode === 'import'
                        ? importedPhones.map(p => ({ phone: p }))
                        : []
                })
            });
            const data = await res.json();
            setResult(res.ok ? { success: true, ...data } : { success: false, error: data.error || 'Error desconocido' });
            if (res.ok) {
                setStats(prev => prev + (data.sent || 0));
            }
        } catch (e) {
            setResult({ success: false, error: e.message });
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
            {/* Top bar */}
            <div style={{ padding: '18px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827' }}>
                        <span style={{ color: '#25d366' }}>Envío Masivo</span> Oficial
                    </h1>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>Envía plantillas aprobadas de WhatsApp a tus contactos o etiquetas</p>
                </div>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Enviados este mes</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#065f46', lineHeight: 1.2 }}>{stats.toLocaleString()}</div>
                </div>
            </div>

            {/* Main split layout */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* LEFT: Template config */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

                    {/* Result banner */}
                    {result && (
                        <div style={{ padding: '14px 18px', borderRadius: 10, background: result.success ? '#f0fdf4' : '#fee2e2', border: `1px solid ${result.success ? '#bbf7d0' : '#fecaca'}`, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                            {result.success ? <CheckCircle size={18} color="#15803d" /> : <AlertCircle size={18} color="#b91c1c" />}
                            <span style={{ color: result.success ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
                                {result.success ? `✅ ${result.sent} enviados${result.failed > 0 ? ` | ❌ ${result.failed} fallidos` : ''}` : `Error: ${result.error}`}
                            </span>
                            <button onClick={() => setResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={16} /></button>
                        </div>
                    )}

                    {/* 1. Template picker */}
                    <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            📋 Plantilla WhatsApp
                            {selectedTemplate && <span style={{ marginLeft: 'auto', background: '#dcfce7', color: '#15803d', borderRadius: 999, padding: '2px 10px', fontSize: 11 }}>✓ Seleccionada</span>}
                        </div>
                        <TemplatePicker templates={templates} loading={loadingTemplates} selected={selectedTemplate} onSelect={setSelectedTemplate} />
                    </div>

                    {selectedTemplate && (
                        <>
                            {/* 2. Variables automáticas */}
                            {vars.length > 0 && (
                                <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 6 }}>✏️ Variables Personalizadas</div>
                                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>Estas variables se aplicarán a todos los mensajes enviados.</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {vars.map(v => (
                                            <div key={v}>
                                                <label style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', display: 'block', marginBottom: 4, fontFamily: 'monospace' }}>{`{{${v}}}`}</label>
                                                <input
                                                    value={variables[v] || ''}
                                                    onChange={e => setVariables(prev => ({ ...prev, [v]: e.target.value }))}
                                                    placeholder={`Valor para {{${v}}}`}
                                                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 3. Image upload (if required) */}
                            {needsImage && (
                                <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #fde68a' }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 6 }}>🖼️ Esta plantilla requiere una imagen</div>
                                    <input
                                        value={headerImageUrl}
                                        onChange={e => setHeaderImageUrl(e.target.value)}
                                        placeholder="URL del archivo image (ej: https://example.com/archivo.jpg)"
                                        style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
                                    />
                                    <div style={{ textAlign: 'center', padding: '4px 0 8px', color: '#9ca3af', fontSize: 12 }}>— o —</div>
                                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 8, border: '2px dashed #e5e7eb', cursor: 'pointer', color: '#6b7280', fontSize: 13, fontWeight: 600, background: '#fafafa' }}>
                                        {uploadingImage ? <RotateCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={16} />}
                                        {uploadingImage ? 'Subiendo...' : 'Subir archivo desde mi equipo'}
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleImageFile(e.target.files[0]); }} />
                                    </label>
                                    {headerImageUrl && <div style={{ marginTop: 8, fontSize: 12, color: '#059669' }}>✅ Imagen: {headerImageUrl.substring(0, 60)}...</div>}
                                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>💡 La URL debe ser pública y accesible. Formatos soportados: JPG, PNG.</p>
                                </div>
                            )}

                            {/* 4. Preview */}
                            <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
                                    👁️ Vista previa <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>(las variables se reemplazarán por cada contacto)</span>
                                </div>
                                <div style={{ background: '#e5ddd5', borderRadius: 10, padding: 14 }}>
                                    {needsImage && headerImageUrl && (
                                        <div style={{ marginBottom: 8 }}>
                                            <img src={headerImageUrl} alt="Header" style={{ width: '100%', borderRadius: 8, maxHeight: 120, objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                                        </div>
                                    )}
                                    <div style={{ background: 'white', borderRadius: '0 10px 10px 10px', padding: '10px 14px', maxWidth: '80%', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                                        <div style={{ fontSize: 14, color: '#111827', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                            {applyVars(bodyText, variables)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* 5. Send button */}
                    <button
                        onClick={handleSend}
                        disabled={!canSend}
                        style={{ padding: '14px', borderRadius: 10, border: 'none', background: canSend ? 'linear-gradient(135deg,#25d366,#128c7e)' : '#94a3b8', color: 'white', fontSize: 15, fontWeight: 700, cursor: canSend ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                        {sending ? <><RotateCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</> : <><Send size={18} /> Enviar Mensajes</>}
                    </button>
                </div>

                {/* RIGHT: Contacts panel */}
                <div style={{ width: 320, borderLeft: '1px solid #e5e7eb', background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: 14, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Users size={16} color="#25d366" /> Contactos
                    </div>
                    <ContactPanel
                        tags={tags}
                        conversations={conversations}
                        selectionMode={selectionMode}
                        setSelectionMode={setSelectionMode}
                        selectedTagId={selectedTagId}
                        setSelectedTagId={setSelectedTagId}
                        selectedPhones={selectedPhones}
                        setSelectedPhones={setSelectedPhones}
                        searchContact={searchContact}
                        setSearchContact={setSearchContact}
                        importedPhones={importedPhones}
                        setImportedPhones={setImportedPhones}
                        importInput={importInput}
                        setImportInput={setImportInput}
                    />
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default WaBulkOfficial;
