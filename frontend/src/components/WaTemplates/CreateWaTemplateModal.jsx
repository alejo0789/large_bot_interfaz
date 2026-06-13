import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, HelpCircle } from 'lucide-react';
import apiFetch from '../../utils/api';

const CreateWaTemplateModal = ({ isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('MARKETING');
    const [language, setLanguage] = useState('es');
    
    // Header
    const [headerType, setHeaderType] = useState('NONE'); // NONE | TEXT
    const [headerText, setHeaderText] = useState('');
    
    // Body
    const [bodyText, setBodyText] = useState('');
    
    // Footer
    const [footerText, setFooterText] = useState('');
    
    // Buttons (Quick Reply only to keep it clean and robust)
    const [buttons, setButtons] = useState([]); // Array of strings (button text)

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Auto-clean name to lowercase, alphanumeric and underscores
    const handleNameChange = (val) => {
        const cleaned = val.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        setName(cleaned);
    };

    const handleAddButton = () => {
        if (buttons.length >= 3) return;
        setButtons([...buttons, '']);
    };

    const handleButtonTextChange = (index, val) => {
        const next = [...buttons];
        next[index] = val;
        setButtons(next);
    };

    const handleRemoveButton = (index) => {
        setButtons(buttons.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (!name.trim()) throw new Error('El nombre de la plantilla es requerido');
            if (!bodyText.trim()) throw new Error('El texto del cuerpo es requerido');

            // Build components list
            const components = [];

            // 1. Header
            if (headerType === 'TEXT' && headerText.trim()) {
                const headerComp = {
                    type: 'HEADER',
                    format: 'TEXT',
                    text: headerText.trim()
                };

                // Check for variables in header (e.g. {{1}})
                const headerVars = headerText.match(/\{\{(\d+)\}\}/g);
                if (headerVars) {
                    headerComp.example = {
                        header_text: headerVars.map((_, i) => `ejemplo${i + 1}`)
                    };
                }
                components.push(headerComp);
            }

            // 2. Body
            const bodyComp = {
                type: 'BODY',
                text: bodyText
            };

            // Detect and handle variables in body (e.g. {{1}}, {{2}})
            // Meta expects sequentially numbered variables starting at 1
            const bodyVars = bodyText.match(/\{\{(\d+)\}\}/g);
            if (bodyVars) {
                // Deduplicate and count
                const uniqueVarNums = [...new Set(bodyVars.map(v => parseInt(v.replace(/\{\{|\}\}/g, ''), 10)))];
                // Ensure they are sequential starting at 1
                const maxVar = Math.max(...uniqueVarNums);
                
                // Construct sequential dummy examples array
                const dummyExamples = [];
                for (let i = 1; i <= maxVar; i++) {
                    dummyExamples.push(`valor${i}`);
                }

                bodyComp.example = {
                    body_text: [dummyExamples]
                };
            }
            components.push(bodyComp);

            // 3. Footer
            if (footerText.trim()) {
                components.push({
                    type: 'FOOTER',
                    text: footerText.trim()
                });
            }

            // 4. Buttons
            const validButtons = buttons.filter(b => b.trim());
            if (validButtons.length > 0) {
                components.push({
                    type: 'BUTTONS',
                    buttons: validButtons.map(text => ({
                        type: 'QUICK_REPLY',
                        text: text.trim()
                    }))
                });
            }

            const response = await apiFetch('/api/wa-templates/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name.trim(),
                    category,
                    language,
                    components
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Error al enviar plantilla a aprobación');
            }

            onSuccess();
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '650px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#f9fafb'
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
                            Crear Plantilla Oficial
                        </h2>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                            Envía una plantilla directamente a Meta para su revisión y aprobación
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{
                            background: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#6b7280'
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {error && (
                            <div style={{ padding: '12px 16px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
                                ❌ {error}
                            </div>
                        )}

                        {/* Basic Info Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Nombre único de Plantilla</label>
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    placeholder="ej: promo_dia_padre"
                                    required
                                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                                />
                                <span style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px', display: 'block' }}>Solo letras minúsculas, números y guiones bajos (_)</span>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Categoría</label>
                                <select 
                                    value={category} 
                                    onChange={(e) => setCategory(e.target.value)}
                                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', backgroundColor: 'white', outline: 'none', height: '41px' }}
                                >
                                    <option value="MARKETING">Marketing</option>
                                    <option value="UTILITY">Utilidad / Serv.</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Idioma</label>
                                <select 
                                    value={language} 
                                    onChange={(e) => setLanguage(e.target.value)}
                                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', backgroundColor: 'white', outline: 'none', height: '41px' }}
                                >
                                    <option value="es">Español (es)</option>
                                    <option value="en">Inglés (en)</option>
                                    <option value="pt_BR">Portugués (pt_BR)</option>
                                </select>
                            </div>
                        </div>

                        {/* Header type & text */}
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', backgroundColor: '#f9fafb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>Encabezado (Opcional)</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                        type="button"
                                        onClick={() => setHeaderType('NONE')}
                                        style={{ padding: '6px 12px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', backgroundColor: headerType === 'NONE' ? '#25d366' : 'white', color: headerType === 'NONE' ? 'white' : '#374151', fontWeight: 600 }}
                                    >
                                        Ninguno
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setHeaderType('TEXT')}
                                        style={{ padding: '6px 12px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', backgroundColor: headerType === 'TEXT' ? '#25d366' : 'white', color: headerType === 'TEXT' ? 'white' : '#374151', fontWeight: 600 }}
                                    >
                                        Texto
                                    </button>
                                </div>
                            </div>

                            {headerType === 'TEXT' && (
                                <input 
                                    type="text"
                                    value={headerText}
                                    onChange={(e) => setHeaderText(e.target.value)}
                                    maxLength={60}
                                    placeholder="ej: ¡Confirmación de pedido!"
                                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                                />
                            )}
                        </div>

                        {/* Body Text */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>Cuerpo del Mensaje (Obligatorio)</label>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#6b7280' }}>
                                    <HelpCircle size={13} /> Usa {"{{1}}"}, {"{{2}}"} para variables
                                </span>
                            </div>
                            <textarea 
                                value={bodyText}
                                onChange={(e) => setBodyText(e.target.value)}
                                rows={5}
                                required
                                placeholder={`ej: Hola {{1}},\n\nTu pedido número {{2}} ha sido enviado y llegará pronto.\n\n¡Gracias por tu compra!`}
                                style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* Footer text */}
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>Pie de Página (Opcional)</label>
                            <input 
                                type="text"
                                value={footerText}
                                onChange={(e) => setFooterText(e.target.value)}
                                maxLength={60}
                                placeholder="ej: Responder STOP para cancelar suscripción"
                                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* Buttons section */}
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', backgroundColor: '#f9fafb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151' }}>Botones de Respuesta Rápida (Opcional)</label>
                                    <span style={{ fontSize: '11px', color: '#6b7280' }}>Permite a los clientes responder con un solo toque (máx. 3)</span>
                                </div>
                                {buttons.length < 3 && (
                                    <button 
                                        type="button"
                                        onClick={handleAddButton}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '11px', backgroundColor: 'var(--color-primary-light, #d1fae5)', border: 'none', borderRadius: '6px', color: '#065f46', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        <Plus size={12} /> Agregar Botón
                                    </button>
                                )}
                            </div>

                            {buttons.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {buttons.map((btn, index) => (
                                        <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <input 
                                                type="text"
                                                value={btn}
                                                onChange={(e) => handleButtonTextChange(index, e.target.value)}
                                                maxLength={25}
                                                required
                                                placeholder={`Texto del botón ${index + 1} (ej: Sí, me interesa)`}
                                                style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => handleRemoveButton(index)}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer buttons */}
                    <div style={{
                        padding: '16px 24px',
                        borderTop: '1px solid #e5e7eb',
                        backgroundColor: '#f9fafb',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px'
                    }}>
                        <button 
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            style={{
                                padding: '10px 20px',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                background: 'white',
                                color: '#374151',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Cancelar
                        </button>
                        
                        <button 
                            type="submit"
                            disabled={isLoading}
                            style={{
                                padding: '10px 20px',
                                border: 'none',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, #25d366, #128c7e)',
                                color: 'white',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                opacity: isLoading ? 0.7 : 1
                            }}
                        >
                            {isLoading ? 'Enviando...' : 'Enviar para Aprobación'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateWaTemplateModal;
