import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Cleanup legacy Service Workers before rendering
async function bootstrap() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
  }
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  }

  createRoot(document.getElementById('root')!).render(<App />);
}

void bootstrap();
