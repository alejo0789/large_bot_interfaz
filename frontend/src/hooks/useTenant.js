import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './useAuth';

const TenantContext = createContext(null);

export const TenantProvider = ({ children }) => {
    const { user, loading } = useAuth();
    const [currentTenant, setCurrentTenant] = useState(() => {
        const saved = localStorage.getItem('current_tenant');
        return saved ? JSON.parse(saved) : null;
    });

    // When user changes, ensure they have access to the current tenant
    useEffect(() => {
        // Wait for auth to finish loading before making decisions
        if (loading) return;

        if (!user) {
            setCurrentTenant(null);
            localStorage.removeItem('current_tenant');
            return;
        }

        if (user.tenants && user.tenants.length > 0) {
            const isAllowed = user.role === 'SUPER_ADMIN' || user.tenants.some(t => t.slug === currentTenant?.slug);

            // Auto-select ONLY for regular users or if current is truly invalid/missing
            if (!currentTenant || !isAllowed) {
                // If it's a regular user, MUST have a tenant, pick first one
                if (user.role !== 'SUPER_ADMIN') {
                    const defaultTenant = user.tenants[0];
                    setCurrentTenant(defaultTenant);
                    localStorage.setItem('current_tenant', JSON.stringify(defaultTenant));
                }
                // If it's SUPER_ADMIN, we leave it null (or keep current if it WAS allowed)
                // If it WAS allowed, the if condition wouldn't even be true.
                // If it WAS NOT allowed (invalid slug), and is SUPER_ADMIN, we just clear it to show the card page.
                else if (currentTenant && !isAllowed) {
                    setCurrentTenant(null);
                    localStorage.removeItem('current_tenant');
                }
            }
        }
    }, [user, currentTenant]);

    const selectTenant = (tenant) => {
        setCurrentTenant(tenant);
        localStorage.setItem('current_tenant', JSON.stringify(tenant));
        // Force reload page to clear all buffers/states for the new site
        window.location.reload();
    };

    return (
        <TenantContext.Provider value={{
            currentTenant,
            selectTenant,
            tenants: user?.tenants || []
        }}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => {
    const context = useContext(TenantContext);
    if (!context) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
};
