import React, { useState, useMemo } from 'react';
import { Search, Users, CheckCircle, X, Send, RotateCw } from 'lucide-react';

const ForwardContactsModal = ({ isOpen, onClose, conversations, onSend, messagesToForward }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPhones, setSelectedPhones] = useState([]);
    const [isSending, setIsSending] = useState(false);

    const filteredConversations = useMemo(() => {
        if (!conversations) return [];
        return conversations.filter(c => {
            const query = searchQuery.toLowerCase();
            const name = (c.contact?.name || '').toLowerCase();
            const phone = (c.contact?.phone || '').toLowerCase();
            return name.includes(query) || phone.includes(query);
        });
    }, [conversations, searchQuery]);

    const togglePhone = (phone) => {
        setSelectedPhones(prev => 
            prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
        );
    };

    const handleSend = async () => {
        if (selectedPhones.length === 0 || messagesToForward.length === 0) return;
        setIsSending(true);
        try {
            await onSend(selectedPhones, messagesToForward);
            onClose();
        } catch (error) {
            alert('Error al reenviar mensajes: ' + error.message);
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '400px',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                        Reenviar a...
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                        <input 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar contacto..."
                            style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                    {filteredConversations.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                            <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                            No se encontraron contactos
                        </div>
                    ) : (
                        filteredConversations.map(c => {
                            const phone = c.contact?.phone;
                            const name = c.contact?.name || phone;
                            const isSelected = selectedPhones.includes(phone);
                            return (
                                <div 
                                    key={phone} 
                                    onClick={() => togglePhone(phone)}
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '12px', 
                                        padding: '12px 20px', 
                                        borderBottom: '1px solid #f9fafb', 
                                        cursor: 'pointer',
                                        background: isSelected ? '#f0fdf4' : 'white'
                                    }}
                                >
                                    <div style={{ 
                                        width: '20px', height: '20px', borderRadius: '4px', 
                                        border: isSelected ? 'none' : '2px solid #d1d5db', 
                                        background: isSelected ? '#25d366' : 'white', 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                                    }}>
                                        {isSelected && <CheckCircle size={16} color="white" />}
                                    </div>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,#25d366,#128c7e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                                        {name.charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{phone}</div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                    <span style={{ fontSize: '13px', color: '#4b5563', fontWeight: 600 }}>
                        {selectedPhones.length} seleccionado{selectedPhones.length !== 1 && 's'}
                    </span>
                    <button 
                        onClick={handleSend}
                        disabled={selectedPhones.length === 0 || isSending}
                        style={{ 
                            padding: '10px 20px', 
                            borderRadius: '8px', 
                            border: 'none', 
                            background: selectedPhones.length > 0 ? '#25d366' : '#d1d5db', 
                            color: 'white', 
                            fontSize: '14px', 
                            fontWeight: 700, 
                            cursor: selectedPhones.length > 0 && !isSending ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        {isSending ? <RotateCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                        {isSending ? 'Enviando...' : 'Reenviar'}
                    </button>
                </div>
            </div>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default ForwardContactsModal;
