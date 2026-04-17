export const API_URL = process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');

/**
 * Enhanced fetch wrapper that automatically adds Auth and Tenant headers
 */
export const apiFetch = async (endpoint, options = {}) => {
    const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
    let tenantSlug = null;
    try {
        const tenantStr = localStorage.getItem('current_tenant');
        if (tenantStr && tenantStr !== 'undefined' && tenantStr !== 'null') {
            const tenantData = JSON.parse(tenantStr);
            tenantSlug = tenantData?.slug;
        }
    } catch (e) {
        console.warn('⚠️ Error parsing current_tenant from localStorage:', e);
    }

    const headers = {
        ...options.headers,
    };

    // If body is FormData, don't set Content-Type header to let browser set boundary
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    // If Content-Type is explicitly null, remove it
    if (headers['Content-Type'] === null) {
        delete headers['Content-Type'];
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (tenantSlug) {
        headers['x-sede-slug'] = tenantSlug;
    }

    // Force API Key if it exists in env
    const apiKey = process.env.REACT_APP_API_KEY;
    if (apiKey) {
        headers['x-api-key'] = apiKey;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    // Handle session expiration
    if (response.status === 401 && !endpoint.includes('/api/auth/login')) {
        console.warn('🔴 Sesión expirada o no autorizada. Redirigiendo al login...');
        
        // Clear auth data
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_user');
        
        // Redirect to login (root path handles LoginPage if not authenticated)
        window.location.href = '/?expired=true';
        return response;
    }

    return response;
};

export default apiFetch;
