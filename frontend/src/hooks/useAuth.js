import { useState, useEffect, createContext, useContext, useCallback } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    const API_URL = process.env.REACT_APP_API_URL ||
        (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');

    const logout = useCallback(() => {
        const tokenToRevoke = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
        setToken(null);
        setUser(null);
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_user');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');

        // Optional: Call backend to log logout
        if (tokenToRevoke) {
            fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${tokenToRevoke}` }
            }).catch(console.error);
        }
    }, [API_URL]);

    const refreshUser = useCallback(async () => {
        const storedToken = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
        if (!storedToken) return;

        try {
            const res = await fetch(`${API_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${storedToken}` }
            });
            const data = await res.json();
            if (data.success) {
                setUser(data.user);
                if (sessionStorage.getItem('auth_token')) {
                    sessionStorage.setItem('auth_user', JSON.stringify(data.user));
                } else if (localStorage.getItem('auth_token')) {
                    localStorage.setItem('auth_user', JSON.stringify(data.user));
                }
                return data.user;
            }
        } catch (err) {
            console.error('Error refreshing user:', err);
        }
    }, [API_URL]);

    // Check for existing session on mount
    useEffect(() => {
        const storedToken = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
        const storedUser = sessionStorage.getItem('auth_user') || localStorage.getItem('auth_user');

        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
            refreshUser().finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [refreshUser]);

    const login = async (username, password, rememberMe = false) => {
        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al iniciar sesión');
            }

            setToken(data.token);
            setUser(data.user);

            if (rememberMe) {
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('auth_user', JSON.stringify(data.user));
            } else {
                sessionStorage.setItem('auth_token', data.token);
                sessionStorage.setItem('auth_user', JSON.stringify(data.user));
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const register = async (username, password, name, email) => {
        try {
            const response = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, name, email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al registrar usuario');
            }

            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };



    const updateProfile = (updatedFields) => {
        const newUser = { ...user, ...updatedFields };
        setUser(newUser);
        if (sessionStorage.getItem('auth_token')) {
            sessionStorage.setItem('auth_user', JSON.stringify(newUser));
        } else if (localStorage.getItem('auth_token')) {
            localStorage.setItem('auth_user', JSON.stringify(newUser));
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            loading,
            isAuthenticated: !!user,
            login,
            register,
            logout,
            updateProfile,
            refreshUser
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
