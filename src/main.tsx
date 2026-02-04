import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './utils/serviceWorker'

// Registrar Service Worker para cache busting y actualizaciones automáticas
if (import.meta.env.PROD) {
  registerServiceWorker().catch((error) => {
    console.error('Error registrando Service Worker:', error);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
