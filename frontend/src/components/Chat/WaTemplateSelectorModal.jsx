import React, { useState, useEffect } from 'react';
import { X, Send, RotateCw, CheckCircle, AlertCircle } from 'lucide-react';
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

const WaTemplateSelectorModal = ({ isOpen, onClose, currentPhone }) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [variables, setVariables] = useState({});
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setError(null);
            setSelectedTemplate(null);
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
        } else {
            setVariables({});
        }
    }, [selectedTemplate]);

    if (!isOpen) return null;

    const bodyText = selectedTemplate ? (selectedTemplate.components.find(c => c.type === 'BODY')?.text || '') : '';
    const vars = selectedTemplate ? extractVars(selectedTemplate.components || []) : [];
    const hasImage = selectedTemplate ? (selectedTemplate.components.find(c => c.type === 'HEADER')?.format === 'IMAGE') : false;
    const canSend = selectedTemplate && vars.every(v => variables[v]?.trim());

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
                    headerImageUrl: selectedTemplate.headerImageUrl || null,
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
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '500px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Enviar Plantilla Oficial</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
                </div>

                <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                    {error && (
                        <div style={{ padding: '12px', marginBottom: '16px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                            <RotateCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                            Cargando plantillas...
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Seleccionar Plantilla</label>
                                <select 
                                    value={selectedTemplate?.name || ''} 
                                    onChange={e => {
                                        const tpl = templates.find(t => t.name === e.target.value);
                                        setSelectedTemplate(tpl || null);
                                    }}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: 14 }}
                                >
                                    <option value="">Selecciona una plantilla...</option>
                                    {templates.map(t => (
                                        <option key={t.name} value={t.name}>{t.name} ({t.language})</option>
                                    ))}
                                </select>
                            </div>

                            {selectedTemplate && (
                                <>
                                    {vars.length > 0 && (
                                        <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                            <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600, color: '#374151' }}>Variables</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {vars.map(v => (
                                                    <div key={v}>
                                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>{`{{${v}}}`}</label>
                                                        <input 
                                                            value={variables[v] || ''}
                                                            onChange={e => setVariables({...variables, [v]: e.target.value})}
                                                            placeholder={`Valor para ${v}`}
                                                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {hasImage && !selectedTemplate.headerImageUrl && (
                                        <div style={{ padding: '12px', background: '#fef3c7', color: '#92400e', borderRadius: '8px', fontSize: 12, display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <AlertCircle size={16} />
                                            Esta plantilla requiere imagen, pero no tiene una configurada. (No se enviará).
                                        </div>
                                    )}

                                    <div style={{ padding: '16px', background: '#f3f4f6', borderRadius: '8px', fontSize: 13, color: '#111827', whiteSpace: 'pre-wrap', border: '1px solid #e5e7eb' }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' }}>Vista Previa</div>
                                        {applyVars(bodyText, variables) || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin contenido</span>}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f9fafb' }}>
                    <button 
                        onClick={onClose}
                        style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSend}
                        disabled={!canSend || sending || (hasImage && !selectedTemplate?.headerImageUrl)}
                        style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#25d366', color: 'white', fontSize: 14, fontWeight: 600, cursor: canSend && !sending ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px', opacity: canSend ? 1 : 0.6 }}
                    >
                        {sending ? <RotateCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                        {sending ? 'Enviando...' : 'Enviar Plantilla'}
                    </button>
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default WaTemplateSelectorModal;
