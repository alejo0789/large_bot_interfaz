import { useState, useEffect, createContext, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

    // Check for existing session on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('auth_user');

        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));

            // Verify token validity
            fetch(`${API_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${storedToken}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setUser(data.user);
                        localStorage.setItem('auth_user', JSON.stringify(data.user));
                    } else {
                        logout();
                    }
                })
                .catch(() => logout())
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [API_URL, logout]);

    const login = async (username, password) => {
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

            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('auth_user', JSON.stringify(data.user));

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

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');

        // Optional: Call backend to log logout
        if (token) {
            fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(console.error);
        }
    }, [token]);

    return (
        <AuthContext.Provider value={{
            user,
            token,
            loading,
            isAuthenticated: !!user,
            login,
            register,
            logout
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
