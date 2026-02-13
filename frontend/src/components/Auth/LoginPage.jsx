import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { MessageSquare, Lock, User, LogIn, AlertCircle, UserPlus } from 'lucide-react';

const LoginPage = () => {
    const { login, register } = useAuth();
    const [isRegistering, setIsRegistering] = useState(false);

    // Form state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isRegistering) {
                // Register flow
                if (password.length < 6) {
                    throw new Error('La contraseña debe tener al menos 6 caracteres');
                }
                const result = await register(username, password, name, email);
                if (result.success) {
                    // Auto login after register or show message
                    // For now, let's just switch to login
                    setIsRegistering(false);
                    setError(null);
                    // Could show success message here
                    alert('Usuario creado exitosamente. Por favor inicia sesión.');
                } else {
                    setError(result.error);
                }
            } else {
                // Login flow
                const result = await login(username, password);
                if (!result.success) {
                    setError(result.error);
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
        }}>
            <div style={{
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                width: '100%',
                maxWidth: '400px',
                margin: 'auto',
                overflow: 'hidden',
                marginTop: 'auto',
                marginBottom: 'auto'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px 20px 20px 20px',
                    textAlign: 'center',
                    borderBottom: '1px solid #e5e7eb'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px auto',
                        boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)'
                    }}>
                        <MessageSquare color="white" size={24} />
                    </div>
                    <h2 style={{
                        fontSize: '22px',
                        fontWeight: '700',
                        color: '#1f2937',
                        margin: 0
                    }}>
                        {isRegistering ? 'Crear Cuenta' : 'Bienvenido'}
                    </h2>
                    <p style={{
                        color: '#6b7280',
                        marginTop: '6px',
                        fontSize: '13px'
                    }}>
                        {isRegistering
                            ? 'Regístrate para gestionar conversaciones'
                            : 'Inicia sesión para continuar'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
                    {error && (
                        <div style={{
                            marginBottom: '16px',
                            padding: '10px',
                            background: '#fee2e2',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            color: '#b91c1c',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* Name (Register only) */}
                        {isRegistering && (
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                                    Nombre Completo
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '12px', top: '10px', color: '#9ca3af' }}>
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ej: Juan Pérez"
                                        required={isRegistering}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px 10px 40px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            transition: 'border-color 0.2s',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                                        onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                                Usuario
                            </label>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '12px', top: '10px', color: '#9ca3af' }}>
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Usuario"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px 10px 40px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        transition: 'border-color 0.2s',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                />
                            </div>
                        </div>

                        {/* Email (Register only - optional) */}
                        {isRegistering && (
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                                    Email (Opcional)
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '12px', top: '10px', color: '#9ca3af' }}>
                                        <MessageSquare size={18} />
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="correo@ejemplo.com"
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px 10px 40px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            transition: 'border-color 0.2s',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                                        onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                                Contraseña
                            </label>
                            <div style={{ position: 'relative' }}>
                                <div style={{ position: 'absolute', left: '12px', top: '10px', color: '#9ca3af' }}>
                                    <Lock size={18} />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px 10px 40px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        transition: 'border-color 0.2s',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            marginTop: '20px',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '12px',
                            fontSize: '15px',
                            fontWeight: '600',
                            cursor: loading ? 'wait' : 'pointer',
                            transition: 'opacity 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Procesando...' : (
                            isRegistering ? (
                                <>
                                    <UserPlus size={18} /> Registrarse
                                </>
                            ) : (
                                <>
                                    <LogIn size={18} /> Iniciar Sesión
                                </>
                            )
                        )}
                    </button>

                    <div style={{ marginTop: '16px', textAlign: 'center', paddingBottom: '8px' }}>
                        <button
                            type="button"
                            onClick={() => {
                                setIsRegistering(!isRegistering);
                                setError(null);
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#4f46e5',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                textDecoration: 'none',
                                padding: '8px'
                            }}
                            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                        >
                            {isRegistering
                                ? '¿Ya tienes cuenta? Inicia sesión'
                                : '¿No tienes cuenta? Regístrate'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
