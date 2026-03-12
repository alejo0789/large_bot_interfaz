import React, { useState, useEffect } from 'react';
import { X, Users, MessageSquare, Send, CheckCircle2, ChevronRight } from 'lucide-react';
import apiFetch from '../../utils/api';

const FollowUpModal = ({ isOpen, onClose, onSelectLead, onBulkAction }) => {
    const [stats, setStats] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Lead classification labels and colors
    const classificationConfig = {
        'LID_6H': { label: '6 Horas', color: '#34d399', description: 'Leads recientes' },
        'LID_12H': { label: '12 Horas', color: '#10b981', description: 'Seguimiento medio' },
        'LID_1D': { label: '1 Día', color: '#f59e0b', description: 'Requiere atención' },
        'LID_2D': { label: '2 Días', color: '#ef4444', description: 'Urgente' },
        'LID_3D_PLUS': { label: '3+ Días', color: '#7f1d1d', description: 'Crítico / Frío' }
    };

    useEffect(() => {
        if (isOpen) {
            fetchStats();
        }
    }, [isOpen]);

    const fetchStats = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiFetch('/api/conversations/lead-stats');
            if (!response.ok) throw new Error('Error al cargar estadísticas');
            const data = await response.json();
            
            // Map and sort based on predefined order
            const order = ['LID_6H', 'LID_12H', 'LID_1D', 'LID_2D', 'LID_3D_PLUS'];
            const sortedData = data.sort((a, b) => 
                order.indexOf(a.classification) - order.indexOf(b.classification)
            );
            
            setStats(sortedData);
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
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
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
                borderRadius: 'var(--radius-xl)',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden',
                animation: 'modalFadeIn 0.3s ease-out'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--color-gray-200)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'var(--color-gray-50)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            backgroundColor: 'var(--color-primary)',
                            padding: '10px',
                            borderRadius: '12px',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-gray-900)' }}>
                                Seguimiento de Leads
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>
                                Clasificación por tiempo de inactividad
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{
                            background: 'white',
                            border: '1px solid var(--color-gray-200)',
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'var(--color-gray-500)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                            e.currentTarget.style.color = 'var(--color-gray-900)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.color = 'var(--color-gray-500)';
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{
                    padding: '24px',
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <div className="animate-spin" style={{ 
                                margin: '0 auto 16px', 
                                width: '40px', 
                                height: '40px', 
                                border: '4px solid var(--color-gray-200)', 
                                borderTopColor: 'var(--color-primary)', 
                                borderRadius: '50%' 
                            }} />
                            <p style={{ color: 'var(--color-gray-500)' }}>Cargando estadísticas...</p>
                        </div>
                    ) : error ? (
                        <div style={{ 
                            padding: '16px', 
                            backgroundColor: 'var(--color-error-light)', 
                            color: 'var(--color-error)', 
                            borderRadius: '8px',
                            textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    ) : stats.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-gray-500)' }}>
                            No hay leads clasificados en este momento.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                            {stats.map((item) => {
                                const config = classificationConfig[item.classification] || { 
                                    label: item.classification, 
                                    color: '#808080',
                                    description: 'Sin descripción'
                                };
                                return (
                                    <div 
                                        key={item.classification}
                                        style={{
                                            border: '1px solid var(--color-gray-200)',
                                            borderRadius: '16px',
                                            padding: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            backgroundColor: 'white'
                                        }}
                                        onClick={() => onSelectLead(item.classification)}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = config.color;
                                            e.currentTarget.style.boxShadow = `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)`;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--color-gray-200)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{
                                                width: '12px',
                                                height: '48px',
                                                backgroundColor: config.color,
                                                borderRadius: '6px'
                                            }} />
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-gray-900)' }}>
                                                    {config.label}
                                                </h3>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                                                    {config.description}
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ textAlign: 'right', borderRight: '1px solid var(--color-gray-100)', paddingRight: '12px' }}>
                                                <span style={{ 
                                                    display: 'block', 
                                                    fontSize: '1.25rem', 
                                                    fontWeight: 700, 
                                                    color: config.color 
                                                }}>
                                                    {item.total}
                                                </span>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--color-gray-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                    Chats
                                                </span>
                                            </div>
                                            
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onBulkAction(item.classification);
                                                }}
                                                title={`Enviar mensaje masivo a ${config.label}`}
                                                style={{
                                                    backgroundColor: 'rgba(18, 140, 126, 0.1)',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    width: '36px',
                                                    height: '36px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'var(--color-primary)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                                    e.currentTarget.style.color = 'white';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'rgba(18, 140, 126, 0.1)';
                                                    e.currentTarget.style.color = 'var(--color-primary)';
                                                }}
                                            >
                                                <Send size={18} />
                                            </button>

                                            <div style={{
                                                backgroundColor: 'var(--color-gray-50)',
                                                borderRadius: '50%',
                                                width: '28px',
                                                height: '28px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--color-gray-400)'
                                            }}>
                                                <ChevronRight size={16} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px 24px',
                    borderTop: '1px solid var(--color-gray-200)',
                    backgroundColor: 'var(--color-gray-50)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                }}>
                    <button 
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '10px',
                            border: '1px solid var(--color-gray-300)',
                            background: 'white',
                            color: 'var(--color-gray-700)',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Cerrar
                    </button>
                    
                    <button 
                        disabled={stats.length === 0}
                        onClick={() => {
                            if (onBulkAction) onBulkAction(stats.map(s => s.classification));
                        }}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '10px',
                            border: 'none',
                            background: 'var(--color-primary)',
                            color: 'white',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: stats.length === 0 ? 0.5 : 1
                        }}
                    >
                        <Send size={18} />
                        Acción Masiva (Todos)
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes modalFadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default FollowUpModal;
