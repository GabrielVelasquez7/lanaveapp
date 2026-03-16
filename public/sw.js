/**
 * Service Worker deshabilitado.
 * Solo elimina registros y caches legacy para cortar loops de auth.
 */

async function destroyLegacyServiceWorker() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));

  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  await self.registration.unregister();

  clients.forEach((client) => {
    client.postMessage({ type: 'SW_DISABLED' });
  });

  clients.forEach((client) => {
    client.navigate(client.url);
  });
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(destroyLegacyServiceWorker());
});

self.addEventListener('fetch', () => {
  // No interceptar requests.
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
