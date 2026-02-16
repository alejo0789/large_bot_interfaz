import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, Legend
} from 'recharts';
import {
    Calendar, MessageSquare, CheckCircle, AlertCircle, TrendingUp, Users, ArrowUp, ArrowDown, Zap
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');

const Dashboard = ({ isMobile }) => {
    const [stats, setStats] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState('today'); // today, yesterday, week, month

    // Calculate dates based on range
    const dates = useMemo(() => {
        const end = new Date();
        const start = new Date();

        switch (dateRange) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                break;
            case 'yesterday':
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end.setDate(end.getDate() - 1);
                end.setHours(23, 59, 59, 999);
                break;
            case 'week':
                start.setDate(start.getDate() - 7);
                break;
            case 'month':
                start.setDate(start.getDate() - 30);
                break;
            default:
                start.setHours(0, 0, 0, 0);
        }
        return { start: start.toISOString(), end: end.toISOString() };
    }, [dateRange]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const queryParams = new URLSearchParams({
                    startDate: dates.start,
                    endDate: dates.end
                });

                const [statsRes, chartRes] = await Promise.all([
                    fetch(`${API_URL}/api/dashboard/stats?${queryParams}`),
                    fetch(`${API_URL}/api/dashboard/charts?${queryParams}`)
                ]);

                if (statsRes.ok && chartRes.ok) {
                    const statsData = await statsRes.json();
                    const chartData = await chartRes.json();
                    console.log('📊 Frontend received stats:', statsData);
                    setStats(statsData);
                    setChartData(chartData);
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [dates]);

    if (isLoading && !stats) {
        return (
            <div className="dashboard-container" style={{
                padding: '24px',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    const formatXAxis = (tickItem) => {
        if (!tickItem) return '';
        const date = new Date(tickItem);
        // For long ranges (week/month), show date
        if (dateRange === 'week' || dateRange === 'month') {
            return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        }
        // For today/yesterday, show time in 24h format (e.g., 14:00)
        // This is much more compact than 02:00 PM
        return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    return (
        <div className="dashboard-container" style={{
            padding: isMobile ? '16px' : '24px',
            height: '100%',
            overflowY: 'auto',
            backgroundColor: '#f8fafc'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                marginBottom: '24px',
                gap: '16px'
            }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Dashboard</h1>
                    <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>Resumen de actividad y rendimiento</p>
                </div>

                <div className="date-filter" style={{
                    display: 'flex',
                    backgroundColor: 'white',
                    padding: '4px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                    {['today', 'yesterday', 'week', 'month'].map((range) => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: dateRange === range ? '#2563eb' : 'transparent',
                                color: dateRange === range ? 'white' : '#64748b',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textTransform: 'capitalize'
                            }}
                        >
                            {range === 'today' && 'Hoy'}
                            {range === 'yesterday' && 'Ayer'}
                            {range === 'week' && '7 Días'}
                            {range === 'month' && '30 Días'}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '24px',
                marginBottom: '24px'
            }}>
                <KPICard
                    title="Mensajes Recibidos"
                    value={stats?.received || 0}
                    icon={<MessageSquare className="w-5 h-5 text-blue-600" />}
                    color="blue"
                />
                <KPICard
                    title="Respuestas IA"
                    value={stats?.aiSent || 0}
                    icon={<Zap className="w-5 h-5 text-emerald-600" />}
                    color="emerald"
                    subtitle="Respuestas automáticas"
                />
                <KPICard
                    title="Respuestas Agentes"
                    value={stats?.sent || 0}
                    icon={<CheckCircle className="w-5 h-5 text-sky-600" />}
                    color="sky"
                />
                <KPICard
                    title="Nuevas Conversaciones"
                    value={stats?.newConversations || 0}
                    icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
                    color="indigo"
                    subtitle="Iniciadas en periodo"
                />
                <KPICard
                    title="Sin Responder"
                    value={stats?.unanswered || 0}
                    icon={<AlertCircle className="w-5 h-5 text-orange-600" />}
                    color="orange"
                    subtitle="Conversaciones activas"
                />
                <KPICard
                    title="Usuarios Activos"
                    value={stats?.agents?.filter(a => a.count > 0).length || 0}
                    icon={<Users className="w-5 h-5 text-purple-600" />}
                    color="purple"
                    subtitle="En este periodo"
                />
            </div>

            {/* Charts Section */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
                gap: '24px'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Chart 1: Messages Coverage */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        padding: '24px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        border: '1px solid #f1f5f9'
                    }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1e293b', marginBottom: '20px' }}>
                            Flujo de Mensajes
                        </h3>
                        <div style={{ height: '300px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0369a1" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#0369a1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="rawTime"
                                        tick={{ fill: '#64748b', fontSize: 11 }}
                                        tickFormatter={formatXAxis}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                        interval="preserveStartEnd"
                                        minTickGap={30}
                                    />
                                    <YAxis
                                        tick={{ fill: '#64748b', fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                        labelFormatter={(label) => new Date(label).toLocaleString('es-CO')}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Area
                                        type="monotone"
                                        dataKey="received"
                                        name="Recibidos"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorReceived)"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="ai"
                                        name="Resp. IA"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorAI)"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="sent"
                                        name="Resp. Agente"
                                        stroke="#0369a1"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorSent)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Chart 2: New Conversations */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        padding: '24px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        border: '1px solid #f1f5f9'
                    }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1e293b', marginBottom: '20px' }}>
                            Nuevas Conversaciones
                        </h3>
                        <div style={{ height: '250px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#9333ea" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="rawTime"
                                        tick={{ fill: '#64748b', fontSize: 11 }}
                                        tickFormatter={formatXAxis}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                        interval="preserveStartEnd"
                                        minTickGap={30}
                                    />
                                    <YAxis
                                        tick={{ fill: '#64748b', fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                        allowDecimals={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                        labelFormatter={(label) => new Date(label).toLocaleString('es-CO')}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Area
                                        type="monotone"
                                        dataKey="created"
                                        name="Nuevas"
                                        stroke="#9333ea"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorCreated)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>

                {/* Agent Performance */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    border: '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1e293b', marginBottom: '20px' }}>
                        Rendimiento Usuarios
                    </h3>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {stats?.agents?.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {stats.agents.map((agent, index) => (
                                    <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%',
                                                backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.875rem', fontWeight: 600, color: '#475569'
                                            }}>
                                                {agent.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span style={{ fontWeight: 500, color: '#334155' }}>{agent.name}</span>
                                        </div>
                                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                            {agent.count} msgs
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                                No hay actividad de usuarios
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const KPICard = ({ title, value, icon, color, subtitle }) => {
    const colors = {
        blue: { bg: '#eff6ff', text: '#2563eb' },
        green: { bg: '#f0fdf4', text: '#16a34a' },
        emerald: { bg: '#ecfdf5', text: '#059669' },
        indigo: { bg: '#eef2ff', text: '#4f46e5' },
        orange: { bg: '#fff7ed', text: '#ea580c' },
        purple: { bg: '#faf5ff', text: '#9333ea' },
        sky: { bg: '#f0f9ff', text: '#0284c7' }
    };

    const theme = colors[color] || colors.blue;

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid #f1f5f9',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                    padding: '10px',
                    borderRadius: '12px',
                    backgroundColor: theme.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {React.cloneElement(icon, { style: { color: theme.text } })}
                </div>
            </div>
            <div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>
                    {value}
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b', marginTop: '4px' }}>
                    {title}
                </div>
                {subtitle && (
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                        {subtitle}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
