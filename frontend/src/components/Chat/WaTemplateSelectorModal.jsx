import React, { useState, useEffect } from 'react';
import { X, Send, RotateCw, CheckCircle, AlertCircle, Search, Image as ImageIcon, ChevronLeft, Upload } from 'lucide-react';
import apiFetch from '../../utils/api';

// Helpers
function extractVars(components = []) {
    const vars = new Set();
    components.forEach(c => {
        const text = c.text || '';
        (text.match(/\{\{(\w+)\}\}/g) || []).forEach(m => vars.add(m.replace(/\{\{|\}\}/g, '')));
    });
    return [...vars];
}

function applyVars(text, vars) {
    let result = text;
    Object.entries(vars).forEach(([k, v]) => {
        result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || `{{${k}}}`);
    });
    return result;
}

function getBodyText(components = []) {
    return components.find(c => c.type === 'BODY')?.text || '';
}

function getHeaderText(components = []) {
    return components.find(c => c.type === 'HEADER' && c.format === 'TEXT')?.text || '';
}

function getFooterText(components = []) {
    return components.find(c => c.type === 'FOOTER')?.text || '';
}

function getButtons(components = []) {
    return components.find(c => c.type === 'BUTTONS')?.buttons || [];
}

const CATEGORY_COLOR = {
    MARKETING: { bg: '#f3e8ff', color: '#7c3aed' },
    UTILITY:   { bg: '#dbeafe', color: '#1d4ed8' },
    AUTHENTICATION: { bg: '#fef3c7', color: '#b45309' },
};

const WaTemplateSelectorModal = ({ isOpen, onClose, currentPhone }) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [variables, setVariables] = useState({});
    const [headerImageUrl, setHeaderImageUrl] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setError(null);
            setSelectedTemplate(null);
            setHeaderImageUrl('');
            setSearch('');
            apiFetch('/api/wa-templates?status=APPROVED')
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setTemplates(data.templates || []);
                    } else {
                        setError(data.error || 'Error cargando plantillas');
                    }
                })
                .catch(err => setError(err.message))
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedTemplate) {
            const vars = extractVars(selectedTemplate.components || []);
            setVariables(Object.fromEntries(vars.map(v => [v, ''])));
            setHeaderImageUrl(selectedTemplate.headerImageUrl || '');
        } else {
            setVariables({});
            setHeaderImageUrl('');
        }
    }, [selectedTemplate]);

    if (!isOpen) return null;

    const filtered = templates.filter(t => {
        if (!search) return true;
        const q = search.toLowerCase();
        return t.name.toLowerCase().includes(q) || getBodyText(t.components).toLowerCase().includes(q);
    });

    const bodyText = selectedTemplate ? getBodyText(selectedTemplate.components || []) : '';
    const vars = selectedTemplate ? extractVars(selectedTemplate.components || []) : [];
    const hasImage = selectedTemplate ? (selectedTemplate.components.find(c => c.type === 'HEADER')?.format === 'IMAGE') : false;
    const canSend = selectedTemplate && vars.every(v => variables[v]?.trim()) && (!hasImage || headerImageUrl);

    const handleImageFile = async (file) => {
        setUploadingImage(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('folder', 'templates');
            const res = await apiFetch('/api/upload', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.file?.url) {
                setHeaderImageUrl(data.file.url);
            } else if (data.url) {
                setHeaderImageUrl(data.url);
            }
        } catch (e) {
            console.error('Upload error', e);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSend = async () => {
        if (!canSend) return;
        setSending(true);
        setError(null);
        try {
            const res = await apiFetch('/api/wa-templates/bulk-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateName: selectedTemplate.name,
                    templateLanguage: selectedTemplate.language,
                    templateText: bodyText,
                    variables,
                    headerImageUrl: headerImageUrl || null,
                    selectionMode: 'manual',
                    recipients: [{ phone: currentPhone }],
                    createCampaign: false
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (data.failed > 0) {
                    setError('La plantilla no se pudo enviar.');
                } else {
                    onClose(); // Success
                }
            } else {
                setError(data.error || 'Error enviando plantilla');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                width: '100%',
                maxWidth: selectedTemplate ? '900px' : '750px',
                height: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                transition: 'max-width 0.3s ease'
            }}>
                {/* HEADER */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {selectedTemplate && (
                            <button 
                                onClick={() => setSelectedTemplate(null)}
                                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                                <ChevronLeft size={18} />
                            </button>
                        )}
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                            {selectedTemplate ? 'Configurar Envío' : 'Seleccionar Plantilla'}
                        </h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: 'white', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                    
                    {/* STEP 1: GRID LIST */}
                    {!selectedTemplate && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
                                <div style={{ position: 'relative' }}>
                                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                                    <input 
                                        value={search} 
                                        onChange={e => setSearch(e.target.value)} 
                                        placeholder="Buscar por nombre o contenido..." 
                                        style={{ width: '100%', padding: '10px 14px 10px 36px', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: 14, outline: 'none', boxSizing: 'border-box', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} 
                                    />
                                </div>
                            </div>
                            
                            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f1f5f9' }}>
                                {loading ? (
                                    <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>
                                        <RotateCw size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                                        Cargando plantillas...
                                    </div>
                                ) : filtered.length === 0 ? (
                                    <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>
                                        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                                        <div style={{ fontSize: 16, fontWeight: 600 }}>No se encontraron plantillas</div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                        {filtered.map(tpl => {
                                            const cat = CATEGORY_COLOR[tpl.category] || CATEGORY_COLOR.UTILITY;
                                            const bText = getBodyText(tpl.components);
                                            const tVars = extractVars(tpl.components);
                                            const hasImg = tpl.components.some(c => c.type === 'HEADER' && c.format === 'IMAGE');
                                            
                                            return (
                                                <div 
                                                    key={tpl.name}
                                                    onClick={() => setSelectedTemplate(tpl)}
                                                    style={{
                                                        background: 'white', borderRadius: '14px', padding: '16px',
                                                        border: '1px solid #e5e7eb', cursor: 'pointer',
                                                        transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                                        display: 'flex', flexDirection: 'column'
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'; e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', wordBreak: 'break-word', flex: 1 }}>{tpl.name}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                                        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: 10, fontWeight: 700, background: cat.bg, color: cat.color }}>{tpl.category}</span>
                                                        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: 10, fontWeight: 700, background: '#f3f4f6', color: '#4b5563' }}>{tpl.language}</span>
                                                    </div>
                                                    <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5, margin: '0 0 16px 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
                                                        {bText}
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                                                        {hasImg && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 11, color: '#059669', fontWeight: 600, background: '#dcfce7', padding: '4px 8px', borderRadius: '6px' }}><ImageIcon size={12} /> Imagen</span>}
                                                        {tVars.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 11, color: '#7c3aed', fontWeight: 600, background: '#f3e8ff', padding: '4px 8px', borderRadius: '6px' }}>{`{{ }}`} {tVars.length} vars</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 2: PREVIEW & VARS */}
                    {selectedTemplate && (
                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* Variables Form */}
                            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: 'white' }}>
                                <div style={{ marginBottom: '24px' }}>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: 20, fontWeight: 800, color: '#111827' }}>{selectedTemplate.name}</h3>
                                    <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Completa los campos requeridos para previsualizar y enviar.</p>
                                </div>

                                {error && (
                                    <div style={{ padding: '14px', marginBottom: '24px', background: '#fee2e2', color: '#b91c1c', borderRadius: '10px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}>
                                        <AlertCircle size={18} /> {error}
                                    </div>
                                )}

                                {hasImage && (
                                    <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 10, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <ImageIcon size={16} color="#0ea5e9" /> Imagen Requerida
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <input
                                                value={headerImageUrl}
                                                onChange={e => setHeaderImageUrl(e.target.value)}
                                                placeholder="URL de la imagen (ej: https://...)"
                                                style={{ flex: 1, padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: 14, outline: 'none' }}
                                            />
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', background: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: '#475569', fontSize: 13, fontWeight: 600, transition: 'background 0.2s' }} onMouseEnter={e=>e.currentTarget.style.background='#e2e8f0'} onMouseLeave={e=>e.currentTarget.style.background='#f1f5f9'}>
                                                {uploadingImage ? <RotateCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={16} />}
                                                {uploadingImage ? 'Subiendo...' : 'Subir'}
                                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleImageFile(e.target.files[0]); }} />
                                            </label>
                                        </div>
                                        {!headerImageUrl && (
                                            <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#ef4444', fontWeight: 500 }}>* Debes proveer una imagen para enviar esta plantilla.</p>
                                        )}
                                    </div>
                                )}

                                {vars.length > 0 && (
                                    <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>Variables Personalizadas</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {vars.map(v => (
                                                <div key={v}>
                                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6, fontFamily: 'monospace' }}>{`{{${v}}}`}</label>
                                                    <input 
                                                        value={variables[v] || ''}
                                                        onChange={e => setVariables({...variables, [v]: e.target.value})}
                                                        placeholder={`Ingresa el valor para ${v}`}
                                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {vars.length === 0 && !hasImage && (
                                    <div style={{ padding: '20px', background: '#f0fdf4', color: '#166534', borderRadius: '12px', border: '1px solid #bbf7d0', fontSize: 14, fontWeight: 500 }}>
                                        ✅ Esta plantilla no requiere variables adicionales. Está lista para enviarse.
                                    </div>
                                )}
                            </div>

                            {/* Preview Panel */}
                            <div style={{ width: '380px', background: '#f1f5f9', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                                <div style={{ padding: '16px 24px', fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
                                    Vista Previa
                                </div>
                                <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', justifyContent: 'center', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 60 60\'%3E%3Cpath d=\'M0 0h30v30H0zm30 30h30v30H30z\' fill=\'%23ece5dd\' fill-opacity=\'.6\'/%3E%3C/svg%3E")', backgroundColor: '#efeae2' }}>
                                    <div style={{ 
                                        width: '100%', 
                                        maxWidth: '320px',
                                        backgroundColor: 'white',
                                        borderRadius: '0px 12px 12px 12px',
                                        padding: '12px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                                        alignSelf: 'flex-start',
                                        position: 'relative'
                                    }}>
                                        {/* Header Text */}
                                        {getHeaderText(selectedTemplate.components || []) && (
                                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827', marginBottom: '6px' }}>
                                                {getHeaderText(selectedTemplate.components || [])}
                                            </div>
                                        )}

                                        {/* Header Image */}
                                        {hasImage && (
                                            <div style={{ marginBottom: '10px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#f1f5f9', minHeight: headerImageUrl ? 'auto' : '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {headerImageUrl ? (
                                                    <img src={headerImageUrl} alt="Header" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '180px', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                                                ) : (
                                                    <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                        <ImageIcon size={24} />
                                                        Esperando imagen...
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Body Text */}
                                        <div style={{ fontSize: '14px', color: '#111827', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                            {applyVars(bodyText, variables) || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Cuerpo del mensaje...</span>}
                                        </div>

                                        {/* Footer */}
                                        {getFooterText(selectedTemplate.components || []) && (
                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                                                {getFooterText(selectedTemplate.components || [])}
                                            </div>
                                        )}

                                        {/* Time */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                                            <span>Ahora</span>
                                        </div>
                                    </div>
                                    
                                    {/* Buttons */}
                                    {getButtons(selectedTemplate.components || []).length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '320px', marginTop: '8px' }}>
                                            {getButtons(selectedTemplate.components || []).map((btn, idx) => (
                                                <div 
                                                    key={idx} 
                                                    style={{
                                                        backgroundColor: 'white', borderRadius: '8px', padding: '10px',
                                                        textAlign: 'center', fontSize: '14px', color: '#0ea5e9',
                                                        fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                    }}
                                                >
                                                    {btn.text}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Action Buttons */}
                                <div style={{ padding: '20px', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '12px' }}>
                                    <button 
                                        onClick={() => setSelectedTemplate(null)}
                                        style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
                                        onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='white'}
                                    >
                                        Volver
                                    </button>
                                    <button 
                                        onClick={handleSend}
                                        disabled={!canSend || sending}
                                        style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#25d366', color: 'white', fontSize: 14, fontWeight: 700, cursor: canSend && !sending ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: canSend ? 1 : 0.6, boxShadow: '0 4px 6px -1px rgba(37,211,102,0.2)' }}
                                    >
                                        {sending ? <RotateCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
                                        {sending ? 'Enviando...' : 'Enviar Ahora'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default WaTemplateSelectorModal;
