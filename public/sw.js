/**
 * Service Worker para cache busting y actualizaciones automáticas
 * Detecta nuevas versiones y fuerza el refresco de la página
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `static-cache-${CACHE_VERSION}`;

// Archivos estáticos que se cachean inmediatamente
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
];

// Estrategia: Network First para API, Cache First para assets estáticos
const CACHE_STRATEGIES = {
  // API calls: Network first, fallback a cache
  api: {
    pattern: /^https:\/\/.*\.supabase\.co\/.*/i,
    strategy: 'NetworkFirst',
    options: {
      cacheName: 'api-cache',
      networkTimeoutSeconds: 3,
      expiration: {
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutos
      },
    },
  },
  // Assets estáticos: Cache first, fallback a network
  static: {
    pattern: /\.(js|css|woff2?|png|jpg|jpeg|svg|gif|ico)$/i,
    strategy: 'CacheFirst',
    options: {
      cacheName: STATIC_CACHE_NAME,
      expiration: {
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
      },
    },
  },
};

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some static assets:', err);
      });
    })
  );

  // Activar inmediatamente sin esperar a que se cierren otras pestañas
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Limpiar caches antiguos
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name !== CACHE_NAME && 
                     name !== STATIC_CACHE_NAME &&
                     name.startsWith('app-cache-') || 
                     name.startsWith('static-cache-');
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      // Tomar control de todas las pestañas inmediatamente
      self.clients.claim(),
    ])
  );
});

// Interceptar requests
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

  // Determinar estrategia de cache
  let strategy = null;
  let cacheName = CACHE_NAME;

  if (CACHE_STRATEGIES.api.pattern.test(url.href)) {
    strategy = CACHE_STRATEGIES.api.strategy;
    cacheName = CACHE_STRATEGIES.api.options.cacheName;
    event.respondWith(networkFirstStrategy(request, cacheName, CACHE_STRATEGIES.api.options));
  } else if (CACHE_STRATEGIES.static.pattern.test(url.pathname)) {
    strategy = CACHE_STRATEGIES.static.strategy;
    cacheName = STATIC_CACHE_NAME;
    event.respondWith(cacheFirstStrategy(request, cacheName, CACHE_STRATEGIES.static.options));
  } else {
    // Default: Network first para HTML y otros
    event.respondWith(networkFirstStrategy(request, CACHE_NAME, {
      networkTimeoutSeconds: 3,
    }));
  }
});

// Estrategia: Network First (para API y HTML)
async function networkFirstStrategy(request, cacheName, options = {}) {
  const cache = await caches.open(cacheName);
  const networkTimeout = (options.networkTimeoutSeconds || 3) * 1000;

  try {
    // Intentar obtener de la red con timeout
    const networkPromise = fetch(request);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), networkTimeout)
    );

    const response = await Promise.race([networkPromise, timeoutPromise]);

    // Si la respuesta es válida, actualizar cache
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    // Fallback a cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Si no hay cache, devolver error
    throw error;
  }
}

// Estrategia: Cache First (para assets estáticos)
async function cacheFirstStrategy(request, cacheName, options = {}) {
  const cache = await caches.open(cacheName);

  // Intentar obtener de cache primero
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    // Actualizar cache en segundo plano (stale-while-revalidate)
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
      })
      .catch(() => {
        // Ignorar errores de actualización en segundo plano
      });

    return cachedResponse;
  }

  // Si no hay cache, obtener de la red
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
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
      })
    );
  }
});

