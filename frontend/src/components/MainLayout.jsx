import React, { useState } from 'react';
import NavRail from './Navigation/NavRail';
import { Menu, Send } from 'lucide-react';

const MainLayout = ({
    children,
    activeTab,
    onTabChange,
    isMobile,
    onBulkMessage,
    onLogout,
    hideHeader = false,
    isMenuOpen,
    onMenuOpen,
    onMenuClose,
    isCollapsed,
    onToggleCollapse,
    user
}) => {
    const [internalIsMenuOpen, setInternalIsMenuOpen] = useState(false);

    const menuOpen = isMenuOpen !== undefined ? isMenuOpen : internalIsMenuOpen;
    const handleMenuOpen = onMenuOpen || (() => setInternalIsMenuOpen(true));
    const handleMenuClose = onMenuClose || (() => setInternalIsMenuOpen(false));

    const renderNavigation = () => (
        <NavRail
            activeTab={activeTab}
            onTabChange={(tab) => {
                onTabChange(tab);
                handleMenuClose();
            }}
            isMobile={isMobile}
            isOpen={menuOpen}
            onClose={handleMenuClose}
            onOpen={handleMenuOpen}
            onLogout={onLogout}
            onBulkMessage={onBulkMessage}
            isCollapsed={isCollapsed}
            onToggleCollapse={onToggleCollapse}
            user={user}
        />
    );

    return (
        <div className="layout-container" style={{
            display: 'flex',
            height: '100%',
            width: '100%',
            maxWidth: '100vw',
            overflow: 'hidden'
        }}>
            {/* Desktop Navigation Rail */}
            {!isMobile && renderNavigation()}

            {/* Mobile Navigation Drawer */}
            {isMobile && renderNavigation()}

            {/* Main Content Area */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
                height: '100%',
                width: '100%',
                maxWidth: isMobile ? '100vw' : 'none'
            }}>

                {/* Mobile Header */}
                {isMobile && !hideHeader && (
                    <div style={{
                        height: '56px',
                        padding: '0 var(--space-4)',
                        borderBottom: '1px solid var(--color-gray-200)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'white',
                        zIndex: 1000,
                        flexShrink: 0
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                className="btn btn-icon"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleMenuOpen();
                                }}
                                style={{ backgroundColor: 'var(--color-gray-100)' }}
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                            <h1 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--color-gray-800)' }}>
                                {activeTab === 'chat' && 'Chats'}
                                {activeTab === 'ai' && 'IA'}
                                {activeTab === 'dashboard' && 'Dashboard'}
                                {activeTab === 'settings' && 'Config'}
                                {activeTab === 'admin' && 'Administración'}
                            </h1>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                className="btn btn-icon"
                                onClick={() => onTabChange('bulk')}
                                style={{
                                    backgroundColor: 'var(--color-primary)',
                                    color: 'white',
                                    borderRadius: '8px',
                                    width: '36px',
                                    height: '36px'
                                }}
                                title="Envío Masivo"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default MainLayout;
