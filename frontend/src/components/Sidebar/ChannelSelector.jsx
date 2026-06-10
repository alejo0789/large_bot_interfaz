import React from 'react';
import { MessageSquare, MessageCircle, Instagram } from 'lucide-react';

const TikTokIcon = ({ className, style }) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className={className} 
        style={style}
    >
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.74-3.94-1.78-.22-.22-.41-.47-.58-.73v7.02c.01 2.1-.77 4.16-2.22 5.61-1.45 1.47-3.53 2.29-5.63 2.3-2.1.02-4.19-.78-5.65-2.23-1.48-1.46-2.29-3.54-2.29-5.64 0-2.11.81-4.19 2.29-5.65 1.44-1.44 3.52-2.25 5.6-2.24 1.2.01 2.39.31 3.43.89v4.22c-.89-.58-1.97-.87-3.04-.81-1.16.05-2.29.58-3.06 1.45-.77.87-1.15 2.06-1.07 3.22.08 1.17.65 2.26 1.55 3 .9.73 2.08 1.08 3.24 1 .94-.07 1.83-.51 2.44-1.22.56-.66.86-1.52.84-2.39V0h.03z"/>
    </svg>
);

const ChannelSelector = ({ selectedChannel, onSelectChannel }) => {
    const channels = [
        { id: 'all', name: 'Todos', icon: <MessageSquare className="w-4 h-4" />, color: '#11ab9c' },
        { id: 'whatsapp_evolution', name: 'WhatsApp', icon: <MessageCircle className="w-4 h-4" />, color: '#25d366' },
        { id: 'whatsapp_official', name: 'Oficial', icon: <MessageCircle className="w-4 h-4" />, color: '#0084ff' },
        { id: 'instagram', name: 'Instagram', icon: <Instagram className="w-4 h-4" />, color: '#e1306c' },
        { id: 'tiktok', name: 'TikTok', icon: <TikTokIcon className="w-4 h-4" />, color: '#0f1419' }
    ];

    return (
        <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            padding: '4px 4px 12px 4px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
        }} className="channel-selector-scrollbar-hide">
            <style>{`
                .channel-selector-scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
            <div 
                style={{
                    display: 'flex',
                    gap: '8px',
                    width: '100%',
                    paddingBottom: '2px'
                }}
            >
                {channels.map(ch => {
                    const isSelected = selectedChannel === ch.id;
                    return (
                        <button
                            key={ch.id}
                            onClick={() => onSelectChannel(ch.id)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '20px',
                                border: isSelected ? `1.5px solid ${ch.color}` : '1.5px solid var(--color-gray-200)',
                                backgroundColor: isSelected ? `${ch.color}10` : 'white',
                                color: isSelected ? ch.color : 'var(--color-gray-600)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                                boxShadow: isSelected ? `0 2px 4px ${ch.color}15` : 'none',
                                flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                                if (!isSelected) {
                                    e.currentTarget.style.backgroundColor = 'var(--color-gray-50)';
                                    e.currentTarget.style.borderColor = 'var(--color-gray-300)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isSelected) {
                                    e.currentTarget.style.backgroundColor = 'white';
                                    e.currentTarget.style.borderColor = 'var(--color-gray-200)';
                                }
                            }}
                        >
                            <span style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                color: isSelected ? ch.color : 'var(--color-gray-400)' 
                            }}>
                                {ch.icon}
                            </span>
                            <span>{ch.name}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ChannelSelector;
