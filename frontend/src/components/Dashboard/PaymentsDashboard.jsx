import React, { useState, useEffect, useMemo } from 'react';
import { 
    CircleDollarSign, Hash, CheckCircle, Clock, XCircle, Search, 
    Calendar, Filter, RefreshCw, ChevronLeft, ChevronRight, FileText
} from 'lucide-react';
import apiFetch from '../../utils/api';

const PaymentsDashboard = ({ isMobile }) => {
    const [stats, setStats] = useState(null);
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Pagination & Filters
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const limit = 15;

    const [dateRangeType, setDateRangeType] = useState('today'); // today, custom, month
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [statusFilter, setStatusFilter] = useState(''); // '', 'pending', 'verified', 'rejected'

    // Calculate effective dates based on range type
    const dates = useMemo(() => {
        const today = new Date();
        const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        let start = '';
        let end = '';

        if (dateRangeType === 'today') {
            start = formatDate(today);
            end = formatDate(today);
        } else if (dateRangeType === 'month') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            start = formatDate(firstDay);
            end = formatDate(lastDay);
        } else if (dateRangeType === 'custom') {
            start = customStartDate;
            end = customEndDate;
        }

        return { start, end };
    }, [dateRangeType, customStartDate, customEndDate]);

    useEffect(() => {
        // Only fetch if we have valid dates
        if (dateRangeType === 'custom' && (!dates.start || !dates.end)) {
            return;
        }
        fetchData();
    }, [dates, page, statusFilter]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page,
                limit
            });

            if (dates.start) queryParams.append('startDate', dates.start);
            if (dates.end) queryParams.append('endDate', dates.end);
            if (statusFilter) queryParams.append('status', statusFilter);

            const [statsRes, listRes] = await Promise.all([
                apiFetch(`/api/payments/stats?${queryParams.toString()}`),
                apiFetch(`/api/payments?${queryParams.toString()}`)
            ]);

            if (statsRes.ok && listRes.ok) {
                const statsData = await statsRes.json();
                const listData = await listRes.json();
                
                setStats(statsData.rows ? statsData.rows[0] : statsData); // Depending on backend format
                setPayments(listData.payments || []);
                setTotalItems(listData.total || 0);
                setTotalPages(Math.ceil((listData.total || 0) / limit));
            }
        } catch (error) {
            console.error('Error fetching payments dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDateRangeTypeChange = (type) => {
        setDateRangeType(type);
        setPage(1); // Reset pagination on filter change
        if (type === 'today' || type === 'month') {
            setCustomStartDate('');
            setCustomEndDate('');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'verified': return { bg: '#dcfce7', text: '#166534', label: 'Verificado' };
            case 'pending': return { bg: '#fef9c3', text: '#854d0e', label: 'Pendiente' };
            case 'rejected': return { bg: '#fee2e2', text: '#991b1b', label: 'Rechazado' };
            case 'duplicate': return { bg: '#f3f4f6', text: '#374151', label: 'Duplicado' };
            default: return { bg: '#f3f4f6', text: '#374151', label: status };
        }
    };

    // Calculate raw numbers from stats safely
    const statsSource = stats?.summary || stats?.rows?.[0] || stats || {};
    const totalAmount = parseFloat(statsSource.total_amount || 0);
    const verifiedAmount = parseFloat(statsSource.verified_amount || 0);
    const totalTransactions = parseInt(statsSource.total || 0, 10);
    const count20k = parseInt(statsSource.count_20k || 0, 10);
    const pendingCount = parseInt(statsSource.pending || 0, 10);

    return (
        <div className="payments-dashboard" style={{
            padding: isMobile ? '16px' : '24px',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
        }}>
            {/* Header & Date Filters */}
            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: '16px'
            }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CircleDollarSign className="w-6 h-6 text-emerald-600" />
                        Dashboard de Pagos
                    </h1>
                    <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.875rem' }}>Control y seguimiento de notificaciones bancarias</p>
                </div>

                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    alignItems: 'center',
                    backgroundColor: 'white',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', gap: '4px', borderRight: '1px solid #e2e8f0', paddingRight: '12px' }}>
                        <button
                            onClick={() => handleDateRangeTypeChange('today')}
                            style={{
                                padding: '6px 12px', borderRadius: '6px', border: 'none',
                                backgroundColor: dateRangeType === 'today' ? '#10b981' : 'transparent',
                                color: dateRangeType === 'today' ? 'white' : '#64748b',
                                fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >Hoy</button>
                        <button
                            onClick={() => handleDateRangeTypeChange('month')}
                            style={{
                                padding: '6px 12px', borderRadius: '6px', border: 'none',
                                backgroundColor: dateRangeType === 'month' ? '#10b981' : 'transparent',
                                color: dateRangeType === 'month' ? 'white' : '#64748b',
                                fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >Este Mes</button>
                        <button
                            onClick={() => handleDateRangeTypeChange('custom')}
                            style={{
                                padding: '6px 12px', borderRadius: '6px', border: 'none',
                                backgroundColor: dateRangeType === 'custom' ? '#10b981' : 'transparent',
                                color: dateRangeType === 'custom' ? 'white' : '#64748b',
                                fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >Rango Específico</button>
                    </div>

                    {dateRangeType === 'custom' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input 
                                type="date" 
                                value={customStartDate} 
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                            />
                            <span style={{ color: '#64748b' }}>-</span>
                            <input 
                                type="date" 
                                value={customEndDate} 
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                            />
                        </div>
                    )}

                    <button 
                        onClick={fetchData} 
                        disabled={isLoading}
                        style={{ padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'pointer' }}
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '20px'
            }}>
                <KPICard
                    title="Total Ingresado a la Cuenta"
                    value={`$${totalAmount.toLocaleString('es-CO')}`}
                    icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
                    color="emerald"
                    subtitle={`Verificados: $${verifiedAmount.toLocaleString('es-CO')}`}
                />
                <KPICard
                    title="Transacciones Notificadas"
                    value={totalTransactions}
                    icon={<Hash className="w-6 h-6 text-blue-600" />}
                    color="blue"
                />
                <KPICard
                    title="Abonos de $20.000"
                    value={count20k}
                    icon={<CircleDollarSign className="w-6 h-6 text-purple-600" />}
                    color="purple"
                    subtitle="Cantidad de notificaciones"
                />
                <KPICard
                    title="Pendientes por Verificar"
                    value={pendingCount}
                    icon={<Clock className="w-6 h-6 text-orange-600" />}
                    color="orange"
                />
            </div>

            {/* Table Section */}
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                flex: 1
            }}>
                {/* Table Header / Filters */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>Registro de Pagos</h2>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <Filter className="w-4 h-4 text-gray-500" />
                        <select 
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', outline: 'none' }}
                        >
                            <option value="">Todos los estados</option>
                            <option value="verified">Verificados</option>
                            <option value="pending">Pendientes</option>
                            <option value="rejected">Rechazados</option>
                            <option value="duplicate">Duplicados</option>
                        </select>
                    </div>
                </div>

                {/* Table Content */}
                <div style={{ overflowX: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                        <thead style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                            <tr>
                                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Fecha Notificación</th>
                                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Pagador</th>
                                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Monto</th>
                                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Banco</th>
                                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Referencia</th>
                                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Cargando pagos...</td>
                                </tr>
                            ) : payments.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No se encontraron registros para los filtros seleccionados</td>
                                </tr>
                            ) : (
                                payments.map((payment) => {
                                    const st = getStatusColor(payment.status);
                                    return (
                                        <tr key={payment.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '12px 20px' }}>
                                                <div style={{ fontWeight: 500, color: '#334155' }}>{new Date(payment.payment_date).toLocaleDateString('es-CO')}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(payment.payment_date).toLocaleTimeString('es-CO')}</div>
                                            </td>
                                            <td style={{ padding: '12px 20px', color: '#334155', fontWeight: 500 }}>
                                                {payment.payer_name || 'Desconocido'}
                                            </td>
                                            <td style={{ padding: '12px 20px', fontWeight: 600, color: '#0f172a' }}>
                                                ${parseFloat(payment.amount).toLocaleString('es-CO')}
                                            </td>
                                            <td style={{ padding: '12px 20px', color: '#64748b' }}>
                                                {payment.bank || 'N/A'}
                                            </td>
                                            <td style={{ padding: '12px 20px', color: '#64748b', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                                {payment.reference || 'N/A'}
                                            </td>
                                            <td style={{ padding: '12px 20px' }}>
                                                <span style={{ 
                                                    backgroundColor: st.bg, color: st.text, 
                                                    padding: '4px 10px', borderRadius: '9999px', 
                                                    fontSize: '0.75rem', fontWeight: 600 
                                                }}>
                                                    {st.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!isLoading && totalPages > 0 && (
                    <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                            Mostrando {(page - 1) * limit + 1} a {Math.min(page * limit, totalItems)} de {totalItems} registros
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                                disabled={page === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: page === 1 ? '#f1f5f9' : 'white', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                            >
                                <ChevronLeft className="w-4 h-4 text-gray-600" />
                            </button>
                            <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '0.875rem', fontWeight: 500, color: '#334155' }}>
                                Página {page} de {totalPages}
                            </span>
                            <button 
                                disabled={page === totalPages}
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: page === totalPages ? '#f1f5f9' : 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
                            >
                                <ChevronRight className="w-4 h-4 text-gray-600" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const KPICard = ({ title, value, icon, color, subtitle }) => {
    const colors = {
        blue: { bg: '#eff6ff', text: '#2563eb' },
        emerald: { bg: '#ecfdf5', text: '#059669' },
        orange: { bg: '#fff7ed', text: '#ea580c' },
        purple: { bg: '#faf5ff', text: '#9333ea' }
    };
    const theme = colors[color] || colors.blue;

    return (
        <div style={{
            backgroundColor: 'white', borderRadius: '16px', padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '12px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                    padding: '12px', borderRadius: '12px', backgroundColor: theme.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    {React.cloneElement(icon, { style: { color: theme.text } })}
                </div>
            </div>
            <div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b', marginTop: '6px' }}>{title}</div>
                {subtitle && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>{subtitle}</div>}
            </div>
        </div>
    );
};

export default PaymentsDashboard;
