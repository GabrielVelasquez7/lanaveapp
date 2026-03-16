/**
 * Service Worker - Network First para HTML, Cache First para assets con hash
 * NUNCA cachea HTML para evitar páginas en blanco
 */

const CACHE_NAME = 'app-cache-v1';

// Instalación - activar inmediatamente
self.addEventListener('install', () => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

// Activación - limpiar caches antiguos y tomar control
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - diferentes estrategias según el tipo de recurso
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests que no son GET
  if (request.method !== 'GET') return;

  // Ignorar chrome-extension y otros protocolos
  if (!url.protocol.startsWith('http')) return;

  // Ignorar Supabase y APIs externas
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api')) return;

  // CRÍTICO: HTML siempre desde la red, NUNCA cachear
  if (request.mode === 'navigate' || 
      request.destination === 'document' ||
      url.pathname === '/' || 
      url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Assets con hash (inmutables) - Cache First
  const hasHash = /\.[a-f0-9]{8,}\.(js|css|woff2?|png|jpg|svg)$/i.test(url.pathname);
  
  if (hasHash) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Otros recursos - Network First con fallback a cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Mensajes desde la app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => 
      Promise.all(names.map((name) => caches.delete(name)))
    ).then(() => {
      event.source?.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});
