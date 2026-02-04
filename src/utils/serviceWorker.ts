/**
 * Utilidades para gestionar el Service Worker
 * Detecta nuevas versiones y fuerza actualizaciones automáticas
 */

interface ServiceWorkerRegistrationResult {
  registration: globalThis.ServiceWorkerRegistration | null;
  updateAvailable: boolean;
  updateError: Error | null;
}

let registrationPromise: Promise<ServiceWorkerRegistrationResult> | null = null;

/**
 * Registra el Service Worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistrationResult> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers no están soportados en este navegador');
    return {
      registration: null,
      updateAvailable: false,
      updateError: new Error('Service Workers no soportados'),
    };
  }

  // Evitar múltiples registros
  if (registrationPromise) {
    return registrationPromise;
  }

  registrationPromise = (async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[SW] Service Worker registrado:', registration.scope);

      // Detectar actualizaciones
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        console.log('[SW] Nueva versión detectada');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // Hay una nueva versión disponible
              console.log('[SW] Nueva versión instalada, recargando...');
              
              // Notificar a la app
              window.dispatchEvent(new CustomEvent('sw-update-available'));

              // Forzar actualización después de un breve delay
              setTimeout(() => {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }, 1000);
            } else {
              // Primera instalación
              console.log('[SW] Service Worker instalado por primera vez');
            }
          }
        });
      });

      // Escuchar cambios de controlador (nueva versión activada)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW] Nuevo Service Worker activado');
        window.location.reload();
      });

      // Verificar actualizaciones periódicamente
      setInterval(() => {
        registration.update();
      }, 60 * 1000); // Cada minuto

      return {
        registration,
        updateAvailable: false,
        updateError: null,
      };
    } catch (error) {
      console.error('[SW] Error registrando Service Worker:', error);
      return {
        registration: null,
        updateAvailable: false,
        updateError: error as Error,
      };
    }
  })();

  return registrationPromise;
}

/**
 * Desregistra el Service Worker (útil para desarrollo)
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const success = await registration.unregister();
      console.log('[SW] Service Worker desregistrado:', success);
      return success;
    }
    return false;
  } catch (error) {
    console.error('[SW] Error desregistrando Service Worker:', error);
    return false;
  }
}

/**
 * Limpia todos los caches del Service Worker
 */
export async function clearServiceWorkerCache(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log('[SW] Caches limpiados');
    return true;
  } catch (error) {
    console.error('[SW] Error limpiando caches:', error);
    return false;
  }
}

/**
 * Hook para usar en componentes React
 * Importar React en el componente que lo use
 */

