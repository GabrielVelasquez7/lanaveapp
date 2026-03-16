import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const SW_CLEANUP_FLAG = 'legacy-sw-cleanup-done';

async function cleanupLegacyServiceWorkers(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return true;
  }

  const hasActiveController = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
  const shouldReloadOnce = hasActiveController && !sessionStorage.getItem(SW_CLEANUP_FLAG);

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  if (shouldReloadOnce) {
    sessionStorage.setItem(SW_CLEANUP_FLAG, 'true');
    window.location.replace(window.location.href);
    return false;
  }

  sessionStorage.removeItem(SW_CLEANUP_FLAG);
  return true;
}

async function bootstrap() {
  const shouldRender = await cleanupLegacyServiceWorkers();

  if (!shouldRender) {
    return;
  }

  createRoot(document.getElementById('root')!).render(<App />);
}

void bootstrap();
