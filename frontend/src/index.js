import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Estilos globales
import './styles/index.css';

// Configuración para Railway y desarrollo
console.log('🚀 Iniciando aplicación Chatwoot + n8n + WhatsApp');
console.log('📱 Versión:', process.env.REACT_APP_VERSION || '1.0.0');
console.log('🌍 Entorno:', process.env.NODE_ENV);

// Crear el root de React 18
const root = ReactDOM.createRoot(document.getElementById('root'));

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Uncaught Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', marginTop: '50px' }}>
          <h2 style={{ color: '#ef4444' }}>Ocurrió un error inesperado</h2>
          <p>{this.state.error?.message || 'Error desconocido'}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: '20px', padding: '10px 20px', background: '#25d366', color: 'white', border: 'none', borderRadius: '5px' }}
          >
            Recargar aplicación
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Renderizar la aplicación
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);

// Performance monitoring para Railway
if (process.env.NODE_ENV === 'production') {
  // Reportar métricas de rendimiento
  const reportWebVitals = (metric) => {
    console.log('📊 Web Vitals:', metric);
    // Aquí puedes enviar métricas a servicios como Google Analytics
  };

  // Medir Core Web Vitals
  if ('web-vitals' in window) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(reportWebVitals);
      getFID(reportWebVitals);
      getFCP(reportWebVitals);
      getLCP(reportWebVitals);
      getTTFB(reportWebVitals);
    });
  }
}

window.addEventListener('unhandledrejection', (event) => {
  const reason = (event.reason || '').toString();
  if (reason.includes('EmptyRanges') || reason.includes('syncControl')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  console.error('🚨 Promise rechazada:', event.reason);
  // En Railway, estos logs aparecerán en el dashboard
}, true);

window.addEventListener('error', (event) => {
  const msg = (event.message || '').toString();
  const errText = (event.error && event.error.toString()) || '';
  if (
    msg.includes('EmptyRanges') || errText.includes('EmptyRanges') ||
    msg.includes('played@') || errText.includes('played@') ||
    msg.includes('syncControl@') || errText.includes('syncControl@') ||
    msg.includes('handleEvent@') || errText.includes('handleEvent@')
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    console.warn('⚠️ Ignorando error nativo de Safari/iOS media:', msg || errText);
    return true;
  }

  console.error('🚨 Error global:', event.error);
  // Enviar errores a servicio de monitoreo si lo deseas
}, true);

// Log de información de Railway
if (window.location.hostname.includes('railway.app')) {
  console.log('🚄 Ejecutándose en Railway');
  console.log('🔗 URL:', window.location.origin);
}

// Detectar capacidades del navegador
const browserFeatures = {
  serviceWorker: 'serviceWorker' in navigator,
  localStorage: typeof Storage !== 'undefined',
  webSockets: 'WebSocket' in window,
  notifications: 'Notification' in window,
  geolocation: 'geolocation' in navigator
};

console.log('🌐 Capacidades del navegador:', browserFeatures);

// Configuración para desarrollo local
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Modo desarrollo activado');
  console.log('🌐 Variables de entorno disponibles:');
  Object.keys(process.env)
    .filter(key => key.startsWith('REACT_APP_'))
    .forEach(key => {
      console.log(`   ${key}: ${process.env[key]}`);
    });
}