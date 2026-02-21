import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    X, Send, Users, Tag, CheckCircle, AlertCircle,
    Image, Video, Mic, Trash2, Loader, Search,
    ClipboardList, FileSpreadsheet, Plus, Upload, Download
} from 'lucide-react';

const API_URL = (() => {
    if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
    if (window.location.hostname !== 'localhost') return 'https://largebotinterfaz-production-5b38.up.railway.app';
    return '';
})();

/**
 * Parse bulk number input (comma/semicolon/newline separated)
 * Normalizes Colombian numbers (57xxxxxxxx → +57xxxxxxxx)
 */
function parseBulkNumbers(input) {
    const items = input.split(/[,;\n]+/).map(s => s.trim()).filter(s => s.length > 0);
    const valid = [];
    const invalid = [];
    const seen = new Set();

    items.forEach(item => {
        // Strip spaces inside
        const cleaned = item.replace(/\s+/g, '');
        // Only digits allowed for phone
        const digitsOnly = cleaned.replace(/\D/g, '');

        if (!digitsOnly || digitsOnly.length < 7) {
            invalid.push(`${item} (muy corto o inválido)`);
            return;
        }

        // Normalize: Colombian numbers starting with 57 or 3xx
        let normalized;
        if (digitsOnly.startsWith('57') && digitsOnly.length >= 11) {
            normalized = `+${digitsOnly}`;
        } else if (digitsOnly.startsWith('3') && digitsOnly.length === 10) {
            normalized = `+57${digitsOnly}`;
        } else if (digitsOnly.length >= 7) {
            normalized = `+${digitsOnly}`;
        } else {
            invalid.push(`${item} (formato no reconocido)`);
            return;
        }

        if (seen.has(normalized)) {
            invalid.push(`${item} (duplicado)`);
            return;
        }

        seen.add(normalized);
        valid.push(normalized);
    });

    return { valid, invalid };
}

/**
 * Parse Excel/CSV file and return array of {phone, name}
 */
async function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length < 2) {
                    reject(new Error('El archivo debe tener al menos una fila de encabezado y una de datos'));
                    return;
                }

                // Parse CSV-like: detect delimiter
                const firstLine = lines[0];
                const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

                const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

                // Find phone and name columns
                const phoneIdx = headers.findIndex(h =>
                    h.includes('telefono') || h.includes('teléfono') || h.includes('phone') ||
                    h.includes('celular') || h.includes('movil') || h.includes('móvil') || h === 'tel'
                );
                const nameIdx = headers.findIndex(h =>
                    h.includes('nombre') || h.includes('name') || h.includes('contacto')
                );

                if (phoneIdx === -1) {
                    reject(new Error('No se encontró columna de teléfono. Usa encabezados: "telefono", "phone", "celular" o "movil"'));
                    return;
                }

                const contacts = [];
                const errors = [];

                for (let i = 1; i < lines.length; i++) {
                    const cells = lines[i].split(delimiter).map(c => c.trim().replace(/['"]/g, ''));
                    const phoneRaw = cells[phoneIdx] || '';
                    const name = nameIdx >= 0 ? (cells[nameIdx] || '') : '';

                    const digitsOnly = phoneRaw.replace(/\D/g, '');
                    if (!digitsOnly || digitsOnly.length < 7) {
                        errors.push(`Fila ${i + 1}: "${phoneRaw}" inválido`);
                        continue;
                    }

                    let phone;
                    if (digitsOnly.startsWith('57') && digitsOnly.length >= 11) {
                        phone = `+${digitsOnly}`;
                    } else if (digitsOnly.startsWith('3') && digitsOnly.length === 10) {
                        phone = `+57${digitsOnly}`;
                    } else {
                        phone = `+${digitsOnly}`;
                    }

                    contacts.push({ phone, name: name || `Usuario ${phone.slice(-4)}` });
                }

                resolve({ contacts, errors });
            } catch (err) {
                reject(new Error(`Error leyendo archivo: ${err.message}`));
            }
        };
        reader.onerror = () => reject(new Error('Error leyendo el archivo'));

        // Try as CSV/text
        try {
            reader.readAsText(file, 'UTF-8');
        } catch {
            reject(new Error('No se pudo leer el archivo. Usa formato CSV o guarda tu Excel como CSV.'));
        }
    });
}

/**
 * Enhanced Bulk message modal component
 * Features:
 * - Filter by tags (fetches ALL contacts from server, not just first 100)
 * - Manual selection from loaded conversations
 * - Paste comma-separated phone numbers
 * - Import from Excel/CSV file
 * - Media attachments (images, videos, audio)
 * - Real-time progress tracking via Socket.IO
 */
const BulkMessageModal = ({
    isOpen,
    onClose,
    conversations,
    tags,
    tagsByPhone = {},
    onSend,
    socket,
    initialMessage = '',
    initialMediaUrl = null,
    initialMediaType = null,
    title = 'Envío Masivo de Mensajes',
    disableSelectionModeChange = false
}) => {
    const [message, setMessage] = useState(initialMessage);
    // Modes: 'all', 'tag', 'manual', 'paste', 'excel'
    const [selectionMode, setSelectionMode] = useState(disableSelectionModeChange ? 'manual' : 'all');
    const [selectedTagIds, setSelectedTagIds] = useState([]);
    const [selectedPhones, setSelectedPhones] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);
    const [manualSearch, setManualSearch] = useState('');

    // Date Filtering
    const [useDateFilter, setUseDateFilter] = useState(false);
    const [dateMonth, setDateMonth] = useState('');

    // Progress tracking
    const [progress, setProgress] = useState(null);
    const [, setBatchId] = useState(null);

    // Media state
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(initialMediaUrl);
    const [mediaType, setMediaType] = useState(initialMediaType);

    // Paste mode state
    const [pasteInput, setPasteInput] = useState('');
    const [pastePreview, setPastePreview] = useState({ valid: [], invalid: [] });
    const [pasteError, setPasteError] = useState('');

    // Excel import state
    const [excelContacts, setExcelContacts] = useState([]); // [{phone, name}]
    const [excelErrors, setExcelErrors] = useState([]);
    const [excelFileName, setExcelFileName] = useState('');
    const [isParsingExcel, setIsParsingExcel] = useState(false);

    // Tag server-fetch state
    const [isFetchingTagContacts, setIsFetchingTagContacts] = useState(false);
    const [tagContactCount, setTagContactCount] = useState(null);

    // 'All' mode server-side total count
    const [allDbCount, setAllDbCount] = useState(null);
    const [isFetchingAllCount, setIsFetchingAllCount] = useState(false);

    const fileInputRef = useRef(null);
    const excelInputRef = useRef(null);

    // Update state when initial props change
    useEffect(() => {
        if (initialMessage) setMessage(initialMessage);
        if (initialMediaUrl) {
            setMediaPreview(initialMediaUrl);
            setMediaType(initialMediaType);
        }
        if (disableSelectionModeChange) {
            setSelectionMode('manual');
        }
    }, [initialMessage, initialMediaUrl, initialMediaType, disableSelectionModeChange]);

    // Helper: build date params string from month filter
    const buildDateParams = useCallback(() => {
        if (!useDateFilter || !dateMonth) return '';
        const [year, month] = dateMonth.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
        return `&startDate=${encodeURIComponent(startDate.toISOString())}&endDate=${encodeURIComponent(endDate.toISOString())}`;
    }, [useDateFilter, dateMonth]);

    // Fetch total count for 'all' mode — re-runs on mode change OR date filter change
    useEffect(() => {
        if (selectionMode !== 'all') return;
        let cancelled = false;
        setIsFetchingAllCount(true);
        setAllDbCount(null);

        const dateParams = buildDateParams();
        fetch(`${API_URL}/api/conversations/recipients-count?${dateParams}`)
            .then(res => res.json())
            .then(data => { if (!cancelled) setAllDbCount(data.total ?? null); })
            .catch(() => { if (!cancelled) setAllDbCount(null); })
            .finally(() => { if (!cancelled) setIsFetchingAllCount(false); });

        return () => { cancelled = true; };
    }, [selectionMode, buildDateParams]);

    // Fetch count for 'tag' mode — re-runs on tag change OR date filter change
    useEffect(() => {
        if (selectionMode !== 'tag' || selectedTagIds.length === 0) {
            setTagContactCount(null);
            return;
        }
        let cancelled = false;
        setIsFetchingTagContacts(true);
        setTagContactCount(null);

        const tagId = selectedTagIds[0];
        const dateParams = buildDateParams();
        fetch(`${API_URL}/api/conversations/recipients-count?tagId=${encodeURIComponent(tagId)}${dateParams}`)
            .then(res => res.json())
            .then(data => { if (!cancelled) setTagContactCount(data.total ?? null); })
            .catch(() => { if (!cancelled) setTagContactCount(null); })
            .finally(() => { if (!cancelled) setIsFetchingTagContacts(false); });

        return () => { cancelled = true; };
    }, [selectedTagIds, selectionMode, buildDateParams]);

    // Socket.IO progress tracking
    useEffect(() => {
        if (!socket) return;

        const handleProgress = (data) => {
            setProgress(data);
        };

        const handleComplete = (data) => {
            setProgress(null);
            setIsSending(false);
            setSendResult({
                success: true,
                count: data.sent,
                failed: data.failed,
                duration: data.duration
            });

            setTimeout(() => {
                setMessage('');
                clearMedia();
                setSendResult(null);
                setBatchId(null);
                onClose();
            }, 3000);
        };

        const handleError = (data) => {
            setProgress(null);
            setIsSending(false);
            setSendResult({ success: false, error: data.error });
        };

        socket.on('bulk-send-progress', handleProgress);
        socket.on('bulk-send-complete', handleComplete);
        socket.on('bulk-send-error', handleError);

        return () => {
            socket.off('bulk-send-progress', handleProgress);
            socket.off('bulk-send-complete', handleComplete);
            socket.off('bulk-send-error', handleError);
        };
    }, [socket, onClose]);

    // ─── Paste mode handlers ─────────────────────────────────────────────────
    const handlePasteInputChange = useCallback((value) => {
        setPasteInput(value);
        setPasteError('');
        if (value.trim()) {
            const preview = parseBulkNumbers(value);
            setPastePreview(preview);
        } else {
            setPastePreview({ valid: [], invalid: [] });
        }
    }, []);

    // ─── Excel import handlers ───────────────────────────────────────────────
    const handleExcelFile = async (file) => {
        if (!file) return;
        // Accept CSV or Excel
        const name = file.name.toLowerCase();
        const isCSV = name.endsWith('.csv');
        const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');

        if (!isCSV && !isExcel) {
            setExcelErrors(['Solo se aceptan archivos .csv, .xlsx o .xls']);
            return;
        }

        if (isExcel && !isCSV) {
            setExcelErrors(['Para archivos Excel (.xlsx/.xls), primero guárdalos como CSV (UTF-8) desde Excel. Alternativamente, crea tu lista en CSV directamente.']);
            setExcelFileName(file.name);
            return;
        }

        setIsParsingExcel(true);
        setExcelErrors([]);
        setExcelContacts([]);
        setExcelFileName(file.name);

        try {
            const { contacts, errors } = await parseExcelFile(file);
            setExcelContacts(contacts);
            setExcelErrors(errors);
        } catch (err) {
            setExcelErrors([err.message]);
        } finally {
            setIsParsingExcel(false);
        }
    };

    // ─── Recipients calculation ──────────────────────────────────────────────
    const recipients = useMemo(() => {
        switch (selectionMode) {
            case 'all':
                return conversations ? conversations.map(c => c.contact.phone) : [];
            case 'tag':
                // Will use server-side filters, but we show local count for UX.
                // tagFilteredConversations is the local approximation.
                if (!conversations) return [];
                return conversations.filter(conv => {
                    const convTags = tagsByPhone[conv.contact.phone] || [];
                    return selectedTagIds.some(tagId =>
                        convTags.some(t => t.id === tagId)
                    );
                }).map(c => c.contact.phone);
            case 'manual':
                return selectedPhones;
            case 'paste':
                return pastePreview.valid;
            case 'excel':
                return excelContacts.map(c => c.phone);
            default:
                return [];
        }
    }, [selectionMode, conversations, tagsByPhone, selectedTagIds, selectedPhones, pastePreview, excelContacts]);

    // Display count: use server-side count for 'all' and 'tag' modes
    const displayCount =
        selectionMode === 'all' && allDbCount !== null ? allDbCount :
            selectionMode === 'tag' && tagContactCount !== null ? tagContactCount :
                recipients.length;

    // ─── Media helpers ───────────────────────────────────────────────────────
    const clearMedia = () => {
        setMediaFile(null);
        setMediaPreview(null);
        setMediaType(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    if (!isOpen) return null;

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        let detectedType = null;
        if (file.type.startsWith('image/')) detectedType = 'image';
        else if (file.type.startsWith('video/')) detectedType = 'video';
        else if (file.type.startsWith('audio/')) detectedType = 'audio';

        setMediaFile(file);
        setMediaType(detectedType);

        if (detectedType === 'image' || detectedType === 'video') {
            const reader = new FileReader();
            reader.onload = (ev) => setMediaPreview(ev.target.result);
            reader.readAsDataURL(file);
        } else {
            setMediaPreview(file.name);
        }
    };

    // ─── Send handler ────────────────────────────────────────────────────────
    const handleSend = async () => {
        if (!message.trim() && !mediaFile && !initialMediaUrl) return;
        // 'all' mode always uses server-side filters (no local recipients needed)
        if (selectionMode !== 'all' && selectionMode !== 'tag' && recipients.length === 0) return;
        if (selectionMode === 'tag' && selectedTagIds.length === 0) return;

        setIsSending(true);
        setSendResult(null);
        setProgress(null);

        try {
            let payload;

            if (selectionMode === 'manual' || selectionMode === 'paste') {
                payload = recipients;
            } else if (selectionMode === 'excel') {
                // Pass explicit list with names
                payload = excelContacts.map(c => c.phone);
            } else {
                // 'all' or 'tag' - use server-side filters
                const filters = {};
                if (selectionMode === 'tag' && selectedTagIds.length > 0) {
                    filters.tagId = selectedTagIds[0];
                }
                if (useDateFilter && dateMonth) {
                    const [year, month] = dateMonth.split('-');
                    const startDate = new Date(year, parseInt(month) - 1, 1);
                    const endDate = new Date(year, parseInt(month), 0, 23, 59, 59, 999);
                    filters.startDate = startDate.toISOString();
                    filters.endDate = endDate.toISOString();
                }
                payload = filters;
            }

            const result = await onSend(payload, message, mediaFile, { mediaUrl: initialMediaUrl, mediaType: initialMediaType });

            if (result.batchId) {
                setBatchId(result.batchId);
                return;
            }

            setSendResult({ success: true, count: Array.isArray(payload) ? payload.length : 'Multiple' });

            setTimeout(() => {
                setMessage('');
                clearMedia();
                setSendResult(null);
                onClose();
            }, 2000);
        } catch (error) {
            setSendResult({ success: false, error: error.message });
            setIsSending(false);
        }
    };

    const togglePhone = (phone) => {
        setSelectedPhones(prev =>
            prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
        );
    };

    const selectAll = () => {
        setSelectedPhones(conversations ? conversations.map(c => c.contact.phone) : []);
    };

    const clearSelection = () => {
        setSelectedPhones([]);
        setSelectedTagIds([]);
    };

    // ─── Styles ───────────────────────────────────────────────────────────────
    const tabBtnStyle = (active) => ({
        flex: 1,
        padding: 'var(--space-2) var(--space-2)',
        border: 'none',
        borderRight: '1px solid var(--color-gray-200)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: active ? 'var(--color-primary)' : 'white',
        color: active ? 'white' : 'var(--color-gray-700)',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap'
    });

    const canSend = (message.trim() || mediaFile || initialMediaUrl) &&
        (
            selectionMode === 'all' ? true :          // 'all' → always valid, backend fetches all
                selectionMode === 'tag' ? selectedTagIds.length > 0 :
                    recipients.length > 0
        ) &&
        !isSending;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '720px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
            >
                {/* ── Header ── */}
                <div className="modal-header" style={{
                    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
                    color: 'white',
                    borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0'
                }}>
                    <h3 className="modal-title" style={{ color: 'white', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Send className="w-5 h-5" />
                        {title}
                    </h3>
                    <button className="btn btn-icon" onClick={onClose} style={{ color: 'white' }}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>

                    {/* ── Progress bar ── */}
                    {progress && (
                        <div style={{
                            padding: 'var(--space-4)',
                            borderRadius: 'var(--radius-lg)',
                            marginBottom: 'var(--space-4)',
                            backgroundColor: 'rgba(99,102,241,0.1)',
                            border: '1px solid rgba(99,102,241,0.2)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--color-gray-700)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <Loader className="w-4 h-4" style={{ animation: 'spin 1s linear infinite' }} />
                                    Enviando mensajes...
                                </span>
                                <span style={{ fontWeight: 600, color: '#6366f1' }}>{progress.progress}%</span>
                            </div>
                            <div style={{ height: '8px', backgroundColor: 'var(--color-gray-200)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
                                <div style={{ height: '100%', width: `${progress.progress}%`, backgroundColor: '#6366f1', borderRadius: 'var(--radius-full)', transition: 'width 0.3s ease' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-600)' }}>
                                <span>
                                    ✅ {progress.sent} enviados
                                    {progress.failed > 0 && <span style={{ color: 'var(--color-error)', marginLeft: '8px' }}>❌ {progress.failed} fallidos</span>}
                                </span>
                                <span>Lote {progress.currentBatch}/{progress.totalBatches}</span>
                            </div>
                        </div>
                    )}

                    {/* ── Send result ── */}
                    {sendResult && (
                        <div style={{
                            padding: 'var(--space-3)',
                            borderRadius: 'var(--radius-lg)',
                            marginBottom: 'var(--space-4)',
                            backgroundColor: sendResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            display: 'flex', alignItems: 'center', gap: 'var(--space-2)'
                        }}>
                            {sendResult.success ? (
                                <>
                                    <CheckCircle className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
                                    <span style={{ color: 'var(--color-success)' }}>
                                        ✅ {sendResult.count} enviados
                                        {sendResult.failed > 0 && ` | ❌ ${sendResult.failed} fallidos`}
                                        {sendResult.duration && ` | ⏱️ ${sendResult.duration}s`}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-5 h-5" style={{ color: 'var(--color-error)' }} />
                                    <span style={{ color: 'var(--color-error)' }}>Error: {sendResult.error}</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Selection mode tabs ── */}
                    {!disableSelectionModeChange && (
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-gray-700)' }}>
                                Modo de selección
                            </h4>
                            <div style={{ display: 'flex', gap: '0', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)', overflow: 'hidden' }}>
                                <button onClick={() => setSelectionMode('all')} style={{ ...tabBtnStyle(selectionMode === 'all'), borderRight: '1px solid var(--color-gray-200)' }}>
                                    <Users style={{ width: 13, height: 13 }} />
                                    Todos ({isFetchingAllCount ? '…' : (allDbCount !== null ? allDbCount : conversations?.length || 0)})
                                </button>
                                <button onClick={() => setSelectionMode('tag')} style={{ ...tabBtnStyle(selectionMode === 'tag'), borderRight: '1px solid var(--color-gray-200)' }}>
                                    <Tag style={{ width: 13, height: 13 }} />
                                    Etiqueta
                                </button>
                                <button onClick={() => setSelectionMode('manual')} style={{ ...tabBtnStyle(selectionMode === 'manual'), borderRight: '1px solid var(--color-gray-200)' }}>
                                    ✓ Manual
                                </button>
                                <button onClick={() => setSelectionMode('paste')} style={{ ...tabBtnStyle(selectionMode === 'paste'), borderRight: '1px solid var(--color-gray-200)' }}>
                                    <ClipboardList style={{ width: 13, height: 13 }} />
                                    Pegar lista
                                </button>
                                <button onClick={() => setSelectionMode('excel')} style={{ ...tabBtnStyle(selectionMode === 'excel'), borderRight: 'none' }}>
                                    <FileSpreadsheet style={{ width: 13, height: 13 }} />
                                    Excel/CSV
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Tag selection panel ── */}
                    {selectionMode === 'tag' && (
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-gray-700)' }}>
                                Seleccionar etiqueta
                            </h4>
                            <div style={{
                                display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap',
                                padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-50)',
                                borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)'
                            }}>
                                {tags && tags.length > 0 ? (
                                    tags.map(tag => (
                                        <button
                                            key={tag.id}
                                            onClick={() => setSelectedTagIds([tag.id])}
                                            style={{
                                                padding: 'var(--space-1) var(--space-3)',
                                                borderRadius: 'var(--radius-full)',
                                                border: selectedTagIds.includes(tag.id) ? `2px solid ${tag.color}` : '2px solid transparent',
                                                backgroundColor: selectedTagIds.includes(tag.id) ? tag.color : 'white',
                                                color: selectedTagIds.includes(tag.id) ? 'white' : tag.color,
                                                cursor: 'pointer',
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: 500,
                                                display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                                                transition: 'all 0.15s',
                                                boxShadow: selectedTagIds.includes(tag.id) ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
                                            }}
                                        >
                                            <Tag style={{ width: 11, height: 11 }} />
                                            {tag.name}
                                        </button>
                                    ))
                                ) : (
                                    <span style={{ color: 'var(--color-gray-500)', fontSize: 'var(--font-size-sm)' }}>
                                        No hay etiquetas disponibles
                                    </span>
                                )}
                            </div>

                            {/* Count preview */}
                            {selectedTagIds.length > 0 && (
                                <div style={{
                                    marginTop: 'var(--space-2)',
                                    padding: 'var(--space-2) var(--space-3)',
                                    backgroundColor: '#eff6ff', borderRadius: 'var(--radius-md)',
                                    border: '1px solid #dbeafe', fontSize: 'var(--font-size-sm)',
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)'
                                }}>
                                    {isFetchingTagContacts ? (
                                        <><Loader style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Consultando en base de datos...</>
                                    ) : (
                                        <><Users style={{ width: 14, height: 14, color: '#3b82f6' }} />
                                            <span style={{ color: '#1d4ed8', fontWeight: 600 }}>
                                                {tagContactCount !== null
                                                    ? `${tagContactCount} contactos con esta etiqueta en la base de datos`
                                                    : `~${recipients.length} en vista actual (el servidor buscará todos)`}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}

                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)', marginTop: 'var(--space-2)' }}>
                                ✅ Se consultará <strong>toda la base de datos</strong> para esta etiqueta, sin límite de los que aparecen en el menú.
                            </p>
                        </div>
                    )}

                    {/* ── 'All' mode server count banner ── */}
                    {selectionMode === 'all' && (
                        <div style={{
                            marginBottom: 'var(--space-3)',
                            padding: 'var(--space-2) var(--space-3)',
                            backgroundColor: '#f0fdf4', borderRadius: 'var(--radius-md)',
                            border: '1px solid #bbf7d0', fontSize: 'var(--font-size-sm)',
                            display: 'flex', alignItems: 'center', gap: 'var(--space-2)'
                        }}>
                            {isFetchingAllCount ? (
                                <><Loader style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Consultando total en base de datos...</>
                            ) : (
                                <><Users style={{ width: 14, height: 14, color: '#16a34a' }} />
                                    <span style={{ color: '#15803d', fontWeight: 600 }}>
                                        {allDbCount !== null
                                            ? `${allDbCount} contactos activos en la base de datos`
                                            : `Se enviarán a todos los contactos activos de la base de datos`}
                                    </span>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Date filter (all/tag modes) ── */}
                    {(selectionMode === 'all' || selectionMode === 'tag') && !disableSelectionModeChange && (
                        <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: '#eff6ff', borderRadius: 'var(--radius-lg)', border: '1px solid #dbeafe' }}>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                <input
                                    type="checkbox"
                                    id="useDateFilter"
                                    checked={useDateFilter}
                                    onChange={(e) => setUseDateFilter(e.target.checked)}
                                    style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
                                />
                                <label htmlFor="useDateFilter" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-gray-700)', cursor: 'pointer' }}>
                                    Filtrar por mes (Remarketing)
                                </label>
                            </div>
                            {useDateFilter && (
                                <div style={{ marginLeft: '24px' }}>
                                    <div style={{ marginBottom: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-600)' }}>
                                        Selecciona el mes de la última interacción:
                                    </div>
                                    <input
                                        type="month"
                                        value={dateMonth}
                                        onChange={(e) => setDateMonth(e.target.value)}
                                        style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-300)', fontSize: 'var(--font-size-sm)', width: '100%' }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Manual selection panel ── */}
                    {selectionMode === 'manual' && (
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-gray-600)', fontWeight: 500 }}>
                                    {selectedPhones.length} de {conversations?.length || 0} seleccionados
                                </span>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button className="btn" onClick={selectAll}
                                        style={{ padding: '4px 12px', fontSize: 'var(--font-size-xs)', backgroundColor: 'var(--color-primary-light)', color: 'white', border: 'none' }}>
                                        Todos
                                    </button>
                                    <button className="btn" onClick={clearSelection}
                                        style={{ padding: '4px 12px', fontSize: 'var(--font-size-xs)', backgroundColor: 'var(--color-gray-200)', color: 'var(--color-gray-700)', border: 'none' }}>
                                        Limpiar
                                    </button>
                                </div>
                            </div>

                            <div style={{ position: 'relative', marginBottom: 'var(--space-2)' }}>
                                <Search className="w-4 h-4" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }} />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o teléfono..."
                                    value={manualSearch}
                                    onChange={(e) => setManualSearch(e.target.value)}
                                    style={{ width: '100%', padding: 'var(--space-2) var(--space-3) var(--space-2) 36px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)', fontSize: 'var(--font-size-sm)' }}
                                />
                            </div>

                            <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-lg)', backgroundColor: 'white' }}>
                                {(conversations || [])
                                    .filter(conv => {
                                        if (!manualSearch) return true;
                                        const q = manualSearch.toLowerCase();
                                        return conv.contact.name?.toLowerCase().includes(q) || conv.contact.phone?.includes(q);
                                    })
                                    .map(conv => {
                                        const convTags = tagsByPhone[conv.contact.phone] || [];
                                        return (
                                            <label key={conv.contact.phone} style={{
                                                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                                                padding: 'var(--space-2) var(--space-3)', cursor: 'pointer',
                                                borderBottom: '1px solid var(--color-gray-100)',
                                                backgroundColor: selectedPhones.includes(conv.contact.phone) ? 'var(--color-primary-bg)' : 'transparent',
                                                transition: 'background-color 0.15s'
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPhones.includes(conv.contact.phone)}
                                                    onChange={() => togglePhone(conv.contact.phone)}
                                                    style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{conv.contact.name}</div>
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)' }}>{conv.contact.phone}</div>
                                                </div>
                                                {convTags.length > 0 && (
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        {convTags.slice(0, 2).map(tag => (
                                                            <span key={tag.id} style={{
                                                                backgroundColor: tag.color, color: 'white',
                                                                padding: '2px 6px', borderRadius: 'var(--radius-full)',
                                                                fontSize: '10px', fontWeight: 500
                                                            }}>{tag.name}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </label>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* ── Paste mode panel ── */}
                    {selectionMode === 'paste' && (
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-gray-700)' }}>
                                Pegar números (separados por coma, punto y coma o nueva línea)
                            </h4>

                            <textarea
                                placeholder={`Ejemplo:\n+573001234567, 3012345678\n573109876543; 3201234567\nO uno por línea...`}
                                value={pasteInput}
                                onChange={(e) => handlePasteInputChange(e.target.value)}
                                rows={5}
                                style={{
                                    width: '100%', resize: 'vertical', fontFamily: 'monospace',
                                    borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-300)',
                                    padding: 'var(--space-3)', fontSize: 'var(--font-size-sm)',
                                    backgroundColor: 'var(--color-gray-50)'
                                }}
                            />

                            {/* Preview */}
                            {(pastePreview.valid.length > 0 || pastePreview.invalid.length > 0) && (
                                <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)' }}>
                                    {pastePreview.valid.length > 0 && (
                                        <div style={{
                                            flex: 1, padding: 'var(--space-2) var(--space-3)',
                                            backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 'var(--radius-md)',
                                            border: '1px solid rgba(16,185,129,0.3)'
                                        }}>
                                            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#059669', marginBottom: '4px' }}>
                                                ✅ {pastePreview.valid.length} válidos
                                            </div>
                                            <div style={{ maxHeight: '80px', overflowY: 'auto', fontSize: '11px', color: '#065f46', fontFamily: 'monospace' }}>
                                                {pastePreview.valid.slice(0, 10).join(', ')}
                                                {pastePreview.valid.length > 10 && ` ... y ${pastePreview.valid.length - 10} más`}
                                            </div>
                                        </div>
                                    )}
                                    {pastePreview.invalid.length > 0 && (
                                        <div style={{
                                            flex: 1, padding: 'var(--space-2) var(--space-3)',
                                            backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)',
                                            border: '1px solid rgba(239,68,68,0.2)'
                                        }}>
                                            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>
                                                ⚠️ {pastePreview.invalid.length} inválidos
                                            </div>
                                            <div style={{ maxHeight: '80px', overflowY: 'auto', fontSize: '11px', color: '#7f1d1d', fontFamily: 'monospace' }}>
                                                {pastePreview.invalid.slice(0, 5).join(', ')}
                                                {pastePreview.invalid.length > 5 && ` ... y ${pastePreview.invalid.length - 5} más`}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {pasteError && (
                                <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-1)' }}>{pasteError}</p>
                            )}

                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)', marginTop: 'var(--space-2)' }}>
                                💡 Los números colombianos de 10 dígitos que empiecen con 3 se normalizan automáticamente a +57xxxx
                            </p>
                        </div>
                    )}

                    {/* ── Excel/CSV import panel ── */}
                    {selectionMode === 'excel' && (
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-gray-700)' }}>
                                Importar desde CSV / Excel
                            </h4>

                            <div style={{
                                border: '2px dashed var(--color-gray-300)', borderRadius: 'var(--radius-lg)',
                                padding: 'var(--space-4)', textAlign: 'center', cursor: 'pointer',
                                backgroundColor: 'var(--color-gray-50)',
                                transition: 'border-color 0.15s, background-color 0.15s'
                            }}
                                onClick={() => excelInputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                                onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-gray-300)'; }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.style.borderColor = 'var(--color-gray-300)';
                                    const file = e.dataTransfer.files[0];
                                    if (file) handleExcelFile(file);
                                }}
                            >
                                <input
                                    ref={excelInputRef}
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleExcelFile(file);
                                        e.target.value = '';
                                    }}
                                />
                                {isParsingExcel ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', color: 'var(--color-primary)' }}>
                                        <Loader style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} />
                                        Procesando archivo...
                                    </div>
                                ) : excelFileName ? (
                                    <div>
                                        <FileSpreadsheet style={{ width: 32, height: 32, color: 'var(--color-primary)', margin: '0 auto 8px' }} />
                                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-gray-700)' }}>{excelFileName}</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)', marginTop: '4px' }}>
                                            Haz clic para cambiar el archivo
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <Upload style={{ width: 32, height: 32, color: 'var(--color-gray-400)', margin: '0 auto 8px' }} />
                                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-gray-700)' }}>
                                            Arrastra tu CSV aquí o haz clic para seleccionar
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)', marginTop: '4px' }}>
                                            Acepta .csv, .xlsx, .xls — Necesita columnas: <strong>telefono</strong> y opcionalmente <strong>nombre</strong>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Excel format hint */}
                            <div style={{
                                marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)',
                                backgroundColor: '#fefce8', borderRadius: 'var(--radius-md)',
                                border: '1px solid #fde68a', fontSize: 'var(--font-size-xs)', color: '#92400e'
                            }}>
                                <strong>📋 Formato esperado (CSV):</strong>
                                <br />
                                <code>nombre,telefono</code>
                                <br />
                                <code>Juan Pérez,3001234567</code>
                                <br />
                                <code>Maria García,+573012345678</code>
                                <br />
                                <br />
                                💡 Para archivos Excel, en Excel usa <em>Archivo → Guardar como → CSV UTF-8</em>
                            </div>

                            {/* Errors */}
                            {excelErrors.length > 0 && (
                                <div style={{
                                    marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)',
                                    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)',
                                    border: '1px solid rgba(239,68,68,0.2)', maxHeight: '100px', overflowY: 'auto'
                                }}>
                                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>
                                        ⚠️ {excelErrors.length} problema(s) encontrado(s):
                                    </div>
                                    {excelErrors.map((err, i) => (
                                        <div key={i} style={{ fontSize: '11px', color: '#7f1d1d' }}>{err}</div>
                                    ))}
                                </div>
                            )}

                            {/* Success preview */}
                            {excelContacts.length > 0 && (
                                <div style={{
                                    marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)',
                                    backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 'var(--radius-md)',
                                    border: '1px solid rgba(16,185,129,0.3)'
                                }}>
                                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#059669', marginBottom: '6px' }}>
                                        ✅ {excelContacts.length} contactos listos para enviar
                                    </div>
                                    <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                        {excelContacts.slice(0, 8).map((c, i) => (
                                            <div key={i} style={{ fontSize: '11px', color: '#065f46', fontFamily: 'monospace', display: 'flex', gap: '8px' }}>
                                                <span style={{ color: '#059669' }}>{c.phone}</span>
                                                {c.name && <span style={{ color: '#047857' }}>— {c.name}</span>}
                                            </div>
                                        ))}
                                        {excelContacts.length > 8 && (
                                            <div style={{ fontSize: '11px', color: '#065f46', fontStyle: 'italic' }}>
                                                ... y {excelContacts.length - 8} más
                                            </div>
                                        )}
                                    </div>
                                    {excelContacts.length > 0 && (
                                        <button
                                            onClick={() => { setExcelContacts([]); setExcelFileName(''); setExcelErrors([]); }}
                                            style={{
                                                marginTop: '6px', padding: '3px 10px', fontSize: '11px',
                                                backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                                borderRadius: 'var(--radius-md)', color: '#dc2626', cursor: 'pointer'
                                            }}
                                        >
                                            Limpiar lista
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Media attachment section ── */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-gray-700)' }}>
                            Adjuntar archivo (opcional)
                        </h4>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="image/*,video/*,audio/*"
                            style={{ display: 'none' }}
                        />

                        {!mediaFile && !initialMediaUrl ? (
                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                <button onClick={() => { fileInputRef.current.accept = 'image/*'; fileInputRef.current.click(); }}
                                    className="media-btn"
                                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--color-gray-100)', border: '1px dashed var(--color-gray-300)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: 'var(--color-gray-600)', fontSize: 'var(--font-size-sm)', transition: 'all 0.2s' }}>
                                    <Image className="w-4 h-4" />Imagen
                                </button>
                                <button onClick={() => { fileInputRef.current.accept = 'video/*'; fileInputRef.current.click(); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--color-gray-100)', border: '1px dashed var(--color-gray-300)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: 'var(--color-gray-600)', fontSize: 'var(--font-size-sm)', transition: 'all 0.2s' }}>
                                    <Video className="w-4 h-4" />Video
                                </button>
                                <button onClick={() => { fileInputRef.current.accept = 'audio/*'; fileInputRef.current.click(); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--color-gray-100)', border: '1px dashed var(--color-gray-300)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: 'var(--color-gray-600)', fontSize: 'var(--font-size-sm)', transition: 'all 0.2s' }}>
                                    <Mic className="w-4 h-4" />Audio
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)' }}>
                                {mediaType === 'image' && mediaPreview && (
                                    <img src={mediaPreview.includes('localhost') && window.location.hostname !== 'localhost'
                                        ? mediaPreview.replace('localhost', window.location.hostname) : mediaPreview}
                                        alt="Preview" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
                                )}
                                {mediaType === 'video' && mediaPreview && (
                                    <video src={mediaPreview.includes('localhost') && window.location.hostname !== 'localhost'
                                        ? mediaPreview.replace('localhost', window.location.hostname) : mediaPreview}
                                        style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
                                )}
                                {mediaType === 'audio' && (
                                    <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
                                        <Mic className="w-8 h-8" style={{ color: 'white' }} />
                                    </div>
                                )}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-gray-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {mediaFile ? mediaFile.name : (initialMediaUrl ? 'Archivo reenviado' : 'Archivo adjunto')}
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-gray-500)' }}>
                                        {mediaFile ? `${(mediaFile.size / 1024 / 1024).toFixed(2)} MB • ` : ''}{mediaType}
                                    </div>
                                </div>
                                <button onClick={clearMedia} style={{ padding: 'var(--space-2)', backgroundColor: 'var(--color-error)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Message input ── */}
                    <div style={{ marginBottom: 'var(--space-3)' }}>
                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-gray-700)' }}>
                            Mensaje {mediaFile ? '(opcional - puede servir como caption)' : ''}
                        </h4>
                        <textarea
                            className="message-input"
                            placeholder="Escribe el mensaje que deseas enviar..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={3}
                            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-300)', padding: 'var(--space-3)' }}
                        />
                    </div>

                    {/* ── Recipients summary ── */}
                    <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-primary-bg)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Users className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                        <span style={{ color: 'var(--color-primary)', fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>
                            {selectionMode === 'tag' && selectedTagIds.length > 0 && tagContactCount !== null
                                ? `Se enviará a ${tagContactCount} contacto${tagContactCount !== 1 ? 's' : ''} (desde base de datos)`
                                : `Se enviará a ${displayCount} contacto${displayCount !== 1 ? 's' : ''}`}
                            {mediaFile && ` con ${mediaType}`}
                        </span>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="modal-footer" style={{ borderTop: '1px solid var(--color-gray-200)', padding: 'var(--space-4)' }}>
                    <button
                        className="btn"
                        onClick={onClose}
                        style={{ backgroundColor: 'var(--color-gray-200)', color: 'var(--color-gray-700)', padding: 'var(--space-2) var(--space-4)' }}
                    >
                        Cancelar
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSend}
                        disabled={!canSend}
                        style={{ padding: 'var(--space-2) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                    >
                        {isSending ? 'Enviando...' : (
                            <>
                                <Send className="w-4 h-4" />
                                Enviar a {selectionMode === 'tag' && tagContactCount !== null ? tagContactCount : displayCount}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkMessageModal;
