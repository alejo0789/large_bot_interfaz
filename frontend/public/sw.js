/* eslint-disable no-restricted-globals */

// This service worker can be customized for caching strategies
const CACHE_NAME = 'chat-large-v1.1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png'
];

self.addEventListener('install', event => {
    // Skip waiting to activate immediately
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('activate', event => {
    // Clean up old caches
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Bypass cache for API, webhook, socket.io and other dynamic requests
    if (url.pathname.includes('/api/') ||
        url.pathname.includes('/webhook/') ||
        url.pathname.includes('/evolution/') ||
        url.pathname.includes('/socket.io/') ||
        url.hostname === 'localhost') {
        return;
    }

    // Network first strategy
    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return caches.match(event.request);
            })
    );
});

// Event for push notifications (The foundation for what you asked)
self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');
    console.log(`[Service Worker] Push had this data: "${event.data.text()}"`);

    const title = 'Nuevo Mensaje - Chat Large';
    const options = {
        body: event.data ? event.data.text() : 'Tienes un nuevo mensaje de WhatsApp.',
        icon: 'logo.png',
        badge: 'logo.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '2'
        }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});
