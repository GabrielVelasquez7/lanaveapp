/**
 * Service Worker para cache busting y actualizaciones automáticas
 * Versión dinámica basada en timestamp de build
 * 
 * IMPORTANTE: Cada deploy genera una nueva versión automáticamente
 */

// Versión dinámica - se actualiza con cada deploy
const BUILD_TIMESTAMP = '__BUILD_TIMESTAMP__';
const CACHE_VERSION = `v${Date.now()}`;
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `static-cache-${CACHE_VERSION}`;

// Archivos HTML que NUNCA deben cachearse (siempre network-first)
const NEVER_CACHE = [
  '/',
  '/index.html',
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...', CACHE_VERSION);
  
  // Activar inmediatamente sin esperar a que se cierren otras pestañas
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Limpiar TODOS los caches antiguos para forzar refresh
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            // Borrar todos los caches anteriores
            if (name !== CACHE_NAME && name !== STATIC_CACHE_NAME) {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            }
          })
        );
      }),
      // Tomar control de todas las pestañas inmediatamente
      self.clients.claim(),
    ]).then(() => {
      // Notificar a todos los clientes que hay una actualización
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        });
      });
    })
  );
});

// Interceptar requests - Network First para TODO (garantiza actualizaciones)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests que no son GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignorar chrome-extension y otros protocolos
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Ignorar requests a Supabase - dejar que pasen directamente
  if (url.hostname.includes('supabase')) {
    return;
  }

  // Para archivos JS/CSS con hash en el nombre, usar cache
  const hasHash = /\.[a-f0-9]{8,}\.(js|css)$/i.test(url.pathname);
  
  if (hasHash) {
    // Cache first para assets con hash (inmutables)
    event.respondWith(cacheFirstWithFallback(request));
  } else {
    // Network first para todo lo demás (HTML, imágenes sin hash, etc.)
    event.respondWith(networkFirstWithCache(request));
  }
});

// Estrategia: Network First con fallback a cache
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request, {
      // Forzar no-cache para asegurar contenido fresco
      cache: 'no-cache',
    });
    
    // Si la respuesta es válida y es un recurso cacheable, guardarlo
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Si falla la red, intentar cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Si no hay cache, propagar el error
    throw error;
  }
}

// Estrategia: Cache First con fallback a network (solo para assets con hash)
async function cacheFirstWithFallback(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    if (response && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('[SW] Failed to fetch:', request.url, error);
    throw error;
  }
}

// Mensaje para forzar actualización
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      }).then(() => {
        // Notificar que los caches fueron limpiados
        event.source.postMessage({ type: 'CACHE_CLEARED' });
      })
    );
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    // Forzar actualización del service worker
    self.registration.update();
  }
});
