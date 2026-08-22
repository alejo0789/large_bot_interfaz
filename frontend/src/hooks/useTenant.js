import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './useAuth';

const TenantContext = createContext(null);

export const TenantProvider = ({ children }) => {
    const { user, loading } = useAuth();
    const [currentTenant, setCurrentTenant] = useState(() => {
        const saved = localStorage.getItem('current_tenant');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // If saved tenant was cali-marketing, clear to allow auto-select of cali
                if (parsed?.slug?.includes('marketing')) {
                    return null;
                }
                return parsed;
            } catch (e) {
                return null;
            }
        }
        return null;
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
            // Check if current tenant is cali_marketing while user has access to main cali
            const caliTenant = user.tenants.find(t => t.slug === 'cali');
            if (currentTenant?.slug?.includes('marketing') && caliTenant) {
                setCurrentTenant(caliTenant);
                localStorage.setItem('current_tenant', JSON.stringify(caliTenant));
                return;
            }

            const isAllowed = user.role === 'SUPER_ADMIN' || user.tenants.some(t => t.slug === currentTenant?.slug);

            // Auto-select ONLY for regular users or if current is truly invalid/missing
            if (!currentTenant || !isAllowed) {
                // If it's a regular user, MUST have a tenant, pick cali if available, or first non-marketing, or first tenant
                if (user.role !== 'SUPER_ADMIN') {
                    const defaultTenant = caliTenant || user.tenants.find(t => !t.slug.includes('marketing')) || user.tenants[0];
                    setCurrentTenant(defaultTenant);
                    localStorage.setItem('current_tenant', JSON.stringify(defaultTenant));
                }
                // If it's SUPER_ADMIN, we leave it null (or keep current if it WAS allowed)
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
