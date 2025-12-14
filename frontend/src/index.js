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

// Renderizar la aplicación
root.render(
  <React.StrictMode>
    <App />
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

// Error boundary global para Railway
window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Promise rechazada:', event.reason);
  // En Railway, estos logs aparecerán en el dashboard
});

window.addEventListener('error', (event) => {
  console.error('🚨 Error global:', event.error);
  // Enviar errores a servicio de monitoreo si lo deseas
});

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