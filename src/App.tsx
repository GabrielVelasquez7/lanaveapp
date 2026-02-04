import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DemoProvider } from "@/contexts/DemoContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";

// Configuración optimizada de React Query con stale-while-revalidate
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale-while-revalidate: muestra datos en caché mientras actualiza en segundo plano
      staleTime: 30 * 1000, // 30 segundos - datos se consideran frescos
      gcTime: 5 * 60 * 1000, // 5 minutos - tiempo en caché (antes cacheTime)
      refetchOnWindowFocus: true, // Refrescar al volver a la ventana
      refetchOnReconnect: true, // Refrescar al reconectar
      refetchOnMount: true, // Refrescar al montar componente
      retry: 2, // Reintentar 2 veces en caso de error
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Network mode: usar caché primero, luego red
      networkMode: 'online',
    },
    mutations: {
      retry: 1,
      networkMode: 'online',
    },
  },
});

// Componente para manejar actualizaciones del Service Worker
const ServiceWorkerUpdater = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Escuchar mensajes del Service Worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          console.log('[App] Nueva versión detectada:', event.data.version);
          // Recargar automáticamente para obtener la nueva versión
          window.location.reload();
        }
        if (event.data && event.data.type === 'CACHE_CLEARED') {
          console.log('[App] Cache limpiado, recargando...');
          window.location.reload();
        }
      });

      // Detectar actualizaciones del Service Worker
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[App] Nuevo Service Worker activo, recargando...');
        // Nueva versión detectada, recargar página
        window.location.reload();
      });

      // Verificar actualizaciones periódicamente (cada 2 minutos)
      const checkForUpdates = async () => {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.update();
            console.log('[App] Verificando actualizaciones...');
          }
        } catch (error) {
          console.error('Error checking for service worker updates:', error);
        }
      };

      // Verificar cada 2 minutos
      const interval = setInterval(checkForUpdates, 2 * 60 * 1000);
      
      // Verificar inmediatamente al cargar
      checkForUpdates();

      // También verificar cuando la ventana vuelve a estar en foco
      const handleFocus = () => {
        checkForUpdates();
      };
      window.addEventListener('focus', handleFocus);

      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, []);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <DemoProvider>
      <TooltipProvider>
          <ServiceWorkerUpdater />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
    </DemoProvider>
  </QueryClientProvider>
);

export default App;
