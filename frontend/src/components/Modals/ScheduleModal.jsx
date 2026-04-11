import React, { useState, useEffect } from 'react';
import { X, Calendar, Search, Loader2 } from 'lucide-react';

// Helper functions for parsing natural text into standard API formats
const monthMap = { enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12' };

const parseDateText = (text) => {
    const match = text.toLowerCase().match(/(\d{1,2})\s*(?:de)?\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);
    if (match) {
        const d = match[1].padStart(2, '0');
        const m = monthMap[match[2]];
        const y = new Date().getFullYear();
        return `${y}-${m}-${d}`;
    }
    return '';
};

const parseTimeText = (text) => {
    const match = text.toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|hrs|horas)?/);
    if (match) {
        let h = parseInt(match[1]);
        const m = match[2] || '00';
        const modifier = match[3];
        if (modifier === 'pm' && h < 12) h += 12;
        if (modifier === 'am' && h === 12) h = 0;
        return `${h.toString().padStart(2, '0')}:${m}`;
    }
    return '';
};

const ScheduleModal = ({ isOpen, onClose, initialData, onSubmit }) => {
    const [formData, setFormData] = useState({
        nombre: '',
        cedula: '',
        telefono: '',
        correo: '',
        servicios: 'alisado',
        abono: 'si',
        valor: '20000',
        fecha: '',
        hora: '',
        referencia: '',
        especialista_id: ''
    });

    const [especialistas, setEspecialistas] = useState([]);
    const [isLoadingEspecialistas, setIsLoadingEspecialistas] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Populate data when modal opens
    useEffect(() => {
        if (isOpen && initialData) {
            let extractedName = initialData.contactName || '';
            let cedula = '';
            let telefono = '';
            let correo = '';
            let fechaText = '';
            let horaText = '';

            if (initialData.messageText) {
                const lines = initialData.messageText.split('\n').map(l => l.trim()).filter(Boolean);
                
                if (lines.length >= 3) {
                    extractedName = lines[0]; // Assuming line 1 is Name
                    
                    correo = lines.find(l => l.includes('@')) || '';
                    
                    const digitLines = lines.filter(l => l.replace(/\D/g, '').length >= 7);
                    if (digitLines.length >= 2) {
                        cedula = digitLines[0].replace(/[^\w\s-]/g, '').trim();
                        telefono = digitLines[1].replace(/[^\w\s-]/g, '').trim();
                    } else if (digitLines.length === 1) {
                        telefono = digitLines[0].replace(/[^\w\s-]/g, '').trim();
                    }

                    const monthsFilter = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
                    const dateLine = lines.find(l => monthsFilter.some(m => l.toLowerCase().includes(m)) || l.includes('/'));
                    if (dateLine) fechaText = dateLine;

                    const timeLine = lines.find(l => l.toLowerCase().includes('am') || l.toLowerCase().includes('pm') || /^\d{1,2}:\d{2}/.test(l));
                    if (timeLine && timeLine !== dateLine) {
                        horaText = timeLine;
                    } else {
                        const fallbackTime = lines.find(l => /^\d{1,2}\s?(am|pm|hrs|horas)$/i.test(l));
                        if (fallbackTime && fallbackTime !== dateLine) {
                            horaText = fallbackTime;
                        }
                    }
                } else {
                     extractedName = lines[0]?.slice(0, 50) || extractedName;
                }
            }

            setFormData({
                nombre: extractedName,
                cedula,
                telefono,
                correo,
                servicios: 'alisado',
                abono: 'si',
                valor: '20000',
                fecha: parseDateText(fechaText), // Auto-parse to YYYY-MM-DD
                hora: parseTimeText(horaText),   // Auto-parse to HH:MM
                referencia: '',
                especialista_id: ''
            });

            // Reset states
            setEspecialistas([]);
            setErrorMsg('');
        }
    }, [isOpen, initialData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const consultarDisponibilidad = async () => {
        if (!formData.fecha || !formData.hora) {
            setErrorMsg('Por favor seleccione fecha y hora para consultar.');
            return;
        }

        setErrorMsg('');
        setIsLoadingEspecialistas(true);
        setEspecialistas([]);
        
        try {
            const url = `https://agendaia-production.up.railway.app/api/especialistas/libres-en-horario?fecha=${formData.fecha}&hora=${formData.hora}`;
            const res = await fetch(url, {
                headers: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInVzZXJfaWQiOjEsImV4cCI6NDkyOTQ3MTIzNywidHlwZSI6ImFjY2VzcyJ9.inm-K9x1wI5YiVJ0JWVDPHZztwLlXrGmqSiyIBSAIsA',
                    'Content-Type': 'application/json'
                }
            });
            const data = await res.json();
            
            // La API devuelve un array directo, filtramos solo los disponibles
            if (Array.isArray(data) && data.length > 0) {
                const disponibles = data.filter(e => e.disponible);
                if (disponibles.length > 0) {
                    setEspecialistas(disponibles);
                    setFormData(prev => ({ ...prev, especialista_id: disponibles[0].id.toString() }));
                } else {
                    setErrorMsg('No hay especialistas disponibles (sin bloqueo o cita) en ese horario.');
                }
            } else {
                setErrorMsg('No hay especialistas en turno para ese horario.');
            }
        } catch (error) {
            console.error('Error fetching especialistas:', error);
            setErrorMsg('Error de conexión al consultar especialistas.');
        } finally {
            setIsLoadingEspecialistas(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.especialista_id) {
            setErrorMsg('Debe seleccionar un especialista disponible.');
            return;
        }

        setIsSubmitting(true);
        setErrorMsg('');

        try {
            const especialistaSeleccionado = especialistas.find(e => e.id.toString() === formData.especialista_id.toString());
            const nombreEspecialista = especialistaSeleccionado ? especialistaSeleccionado.nombre_completo : 'Asignado';

            const payload = {
                nombre: formData.nombre,
                telefono: formData.telefono,
                email: formData.correo,
                cedula: formData.cedula,
                fecha: formData.fecha,
                hora_inicio: formData.hora,
                servicio: formData.servicios,
                sede: "Cali", // Valor por defecto actual
                especialista_id: parseInt(formData.especialista_id),
                monto_abono: formData.abono === 'si' ? parseInt(formData.valor) : 0,
                notas: formData.referencia
            };

            const res = await fetch('https://agendaia-production.up.railway.app/api/citas/agendar-externo', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInVzZXJfaWQiOjEsImV4cCI6NDkyOTQ3MTIzNywidHlwZSI6ImFjY2VzcyJ9.inm-K9x1wI5YiVJ0JWVDPHZztwLlXrGmqSiyIBSAIsA'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData?.detail || errData?.error?.message || 'Error al guardar la cita en el sistema externo (Código ' + res.status + ').');
            }

            // Generar el mensaje con el formato solicitado
            const dateParts = formData.fecha.split('-');
            const dateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
            const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            
            const diaStr = dias[dateObj.getDay()];
            const mesStr = meses[dateObj.getMonth()];
            
            let hStr = formData.hora;
            let ampm = 'AM';
            if (hStr) {
                let [hh, mm] = hStr.split(':');
                let hInt = parseInt(hh);
                if (hInt >= 12) { ampm = 'PM'; if (hInt > 12) hInt -= 12; }
                if (hInt === 0) hInt = 12;
                hStr = `${hInt.toString().padStart(2, '0')}:${mm} ${ampm}`;
            }

            const scheduleDetails = `Hola ${formData.nombre}, te escribimos de CLUB DE ALISADOS LARGE SAS. Tu reserva ha sido agendada para el día: 📅 ${diaStr} ${dateParts[2]} de ${mesStr} - ${dateParts[0]} ⏰ Hora: ${hStr} 📍 Sede CALI – Chipichape.`;
            
            if (onSubmit) {
                onSubmit(scheduleDetails, formData);
            }
            
            onClose();

        } catch (error) {
            console.error('Error submitting appointment:', error);
            setErrorMsg(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
            <div className="modal-content" style={{
                background: 'white', borderRadius: '8px', width: '100%',
                maxWidth: '500px', padding: '20px', maxHeight: '90vh', overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={20} color="var(--color-primary)" />
                        Agendar Cita en Sistema
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                {errorMsg && (
                    <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '13px' }}>
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    
                    <div className="form-group">
                        <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 'bold' }}>Nombre</label>
                        <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 'bold' }}>Cédula</label>
                            <input type="text" name="cedula" value={formData.cedula} onChange={handleChange} required
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 'bold' }}>Teléfono</label>
                            <input type="text" name="telefono" value={formData.telefono} onChange={handleChange} required
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 'bold' }}>Correo Electrónico</label>
                        <input type="email" name="correo" value={formData.correo} onChange={handleChange} 
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                    </div>

                    {/* Date and Time Section linked to API Check */}
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '6px', border: '1px solid #eee' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 'bold' }}>Fecha</label>
                            <input type="date" name="fecha" value={formData.fecha} onChange={handleChange} required
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 'bold' }}>Hora</label>
                            <input type="time" name="hora" value={formData.hora} onChange={handleChange} required
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                        </div>
                        <button type="button" onClick={consultarDisponibilidad} disabled={isLoadingEspecialistas}
                            style={{ padding: '8px 12px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}>
                            {isLoadingEspecialistas ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                            Buscar
                        </button>
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 'bold' }}>Especialista Disponible</label>
                        <select name="especialista_id" value={formData.especialista_id} onChange={handleChange} required disabled={especialistas.length === 0}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', backgroundColor: especialistas.length === 0 ? '#f3f4f6' : 'white' }}>
                            <option value="">{especialistas.length === 0 ? 'Primero consulte disponibilidad 👆' : 'Seleccione especialista...'}</option>
                            {especialistas.map(esp => (
                                <option key={esp.id} value={esp.id}>
                                    {esp.nombre_completo}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 'bold' }}>Servicio</label>
                            <select name="servicios" value={formData.servicios} onChange={handleChange} 
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                                <option value="alisado">Alisado</option>
                                <option value="repolarizacion">Repolarización</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 'bold' }}>Abono</label>
                            <select name="abono" value={formData.abono} onChange={handleChange} 
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                                <option value="si">Sí</option>
                                <option value="no">No</option>
                            </select>
                        </div>
                        {formData.abono === 'si' && (
                            <div className="form-group" style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 'bold' }}>Valor Abono ($)</label>
                                <input type="number" name="valor" value={formData.valor} onChange={handleChange} 
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                        <button type="button" onClick={onClose} style={{
                            padding: '8px 16px', background: '#f1f1f1', border: 'none', borderRadius: '4px', cursor: 'pointer'
                        }}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={isSubmitting || !formData.especialista_id} style={{
                            padding: '8px 16px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px', 
                            cursor: (!formData.especialista_id || isSubmitting) ? 'not-allowed' : 'pointer',
                            opacity: (!formData.especialista_id || isSubmitting) ? 0.6 : 1,
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                            Confirmar y Agendar
                        </button>
                    </div>

                </form>
            </div>
            
            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default ScheduleModal;
