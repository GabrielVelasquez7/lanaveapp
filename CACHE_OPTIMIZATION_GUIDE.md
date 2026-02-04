# Guía de Optimización de Caché y Rendimiento

Este documento describe las implementaciones realizadas para resolver problemas de caché persistente, actualizaciones de datos y rendimiento.

## 📋 Tabla de Contenidos

1. [Cache Busting](#1-cache-busting)
2. [Stale-While-Revalidate](#2-stale-while-revalidate)
3. [Service Worker](#3-service-worker)
4. [Optimización de Renderizado](#4-optimización-de-renderizado)
5. [Headers HTTP](#5-headers-http)
6. [Uso en Componentes](#6-uso-en-componentes)

---

## 1. Cache Busting

### Configuración en Vite

El archivo `vite.config.ts` ha sido configurado para generar hashes automáticos en los nombres de archivos:

- **JS/CSS**: `assets/[name].[hash].js` - Hash basado en contenido
- **Imágenes**: `assets/images/[name].[hash].[ext]`
- **Fuentes**: `assets/fonts/[name].[hash].[ext]`

### Beneficios

- ✅ Los usuarios siempre obtienen la versión más reciente de los archivos
- ✅ Cache agresivo para assets estáticos (30 días)
- ✅ Sin necesidad de Ctrl+F5 manual

### Verificación

Después de hacer build, verifica que los archivos tengan hash:

```bash
npm run build
ls dist/assets/
# Deberías ver: main.a1b2c3d4.js, vendor.e5f6g7h8.js, etc.
```

---

## 2. Stale-While-Revalidate

### Configuración de React Query

React Query está configurado en `src/App.tsx` con:

- **staleTime**: 30 segundos (datos frescos)
- **gcTime**: 5 minutos (tiempo en caché)
- **Refetch automático**: Al montar, al enfocar ventana, al reconectar

### Hook Personalizado: `useStaleWhileRevalidate`

Ubicación: `src/hooks/useStaleWhileRevalidate.ts`

**Características:**
- Muestra datos en caché inmediatamente
- Actualiza en segundo plano sin mostrar loading
- Notifica cuando hay datos actualizados

**Ejemplo de uso:**

```tsx
import { useStaleWhileRevalidate } from '@/hooks/useStaleWhileRevalidate';

function MyComponent() {
  const { data, isLoading, isRefetching, forceRefresh } = useStaleWhileRevalidate(
    ['my-data-key'],
    async () => {
      const response = await fetch('/api/data');
      return response.json();
    },
    {
      staleTime: 30 * 1000, // 30 segundos
      onDataUpdated: (newData) => {
        console.log('Datos actualizados:', newData);
      },
    }
  );

  return (
    <div>
      {data && <div>{/* Mostrar datos inmediatamente */}</div>}
      {isRefetching && <span>Actualizando...</span>}
      <button onClick={forceRefresh}>Forzar actualización</button>
    </div>
  );
}
```

### Hook para Supabase: `useSupabaseQuery`

Ubicación: `src/hooks/useSupabaseQuery.ts`

**Ejemplo de uso:**

```tsx
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

function CuadreList() {
  const { data: cuadres, isLoading, isRefetching } = useSupabaseQuery({
    table: 'daily_cuadres_summary',
    select: '*',
    filters: { session_date: '2024-01-01' },
    staleTime: 30 * 1000,
  });

  if (isLoading) return <div>Cargando...</div>;

  return (
    <div>
      {cuadres?.map(cuadre => (
        <div key={cuadre.id}>{cuadre.total_sales_bs}</div>
      ))}
      {isRefetching && <span>Actualizando en segundo plano...</span>}
    </div>
  );
}
```

---

## 3. Service Worker

### Archivo: `public/sw.js`

El Service Worker implementa:

- ✅ **Cache First** para assets estáticos
- ✅ **Network First** para API calls
- ✅ **Detección automática** de nuevas versiones
- ✅ **Auto-refresh** cuando hay actualizaciones

### Registro Automático

El Service Worker se registra automáticamente en producción (`src/main.tsx`).

### Detección de Actualizaciones

El componente `ServiceWorkerUpdater` en `src/App.tsx`:

- Detecta cuando hay una nueva versión
- Recarga automáticamente la página
- Verifica actualizaciones cada 5 minutos

### Funciones Utilitarias

Ubicación: `src/utils/serviceWorker.ts`

```tsx
import { 
  registerServiceWorker, 
  unregisterServiceWorker,
  clearServiceWorkerCache 
} from '@/utils/serviceWorker';

// Registrar (automático en producción)
await registerServiceWorker();

// Desregistrar (útil para desarrollo)
await unregisterServiceWorker();

// Limpiar todos los caches
await clearServiceWorkerCache();
```

---

## 4. Optimización de Renderizado

### Utilidades de Performance

Ubicación: `src/utils/performance.ts`

**Funciones disponibles:**

1. **`createCleanupManager()`**: Gestiona limpieza de event listeners
2. **`debounce()`**: Evita llamadas excesivas
3. **`throttle()`**: Limita frecuencia de ejecución
4. **`detectMainThreadBlocking()`**: Detecta bloqueos del Main Thread
5. **`monitorMemoryUsage()`**: Monitorea uso de memoria (Chrome/Edge)

### Hook: `usePerformanceOptimization`

Ubicación: `src/hooks/usePerformanceOptimization.ts`

**Ejemplo de uso:**

```tsx
import { usePerformanceOptimization } from '@/hooks/usePerformanceOptimization';

function MyComponent() {
  // Solo en desarrollo o si está habilitado explícitamente
  const { getBlockedCount, getMemoryUsage } = usePerformanceOptimization({
    detectBlocking: import.meta.env.DEV,
    monitorMemory: import.meta.env.DEV,
  });

  // ... resto del componente
}
```

### Prevención de Memory Leaks

**Ejemplo con cleanup manager:**

```tsx
import { useEffect } from 'react';
import { createCleanupManager } from '@/utils/performance';

function MyComponent() {
  useEffect(() => {
    const cleanup = createCleanupManager();

    // Agregar event listeners
    const handleClick = () => console.log('clicked');
    window.addEventListener('click', handleClick);
    cleanup.add(() => window.removeEventListener('click', handleClick));

    // Agregar suscripciones
    const subscription = someObservable.subscribe();
    cleanup.add(() => subscription.unsubscribe());

    // Cleanup automático
    return () => cleanup.cleanup();
  }, []);
}
```

### Optimización de Listas Largas

Para componentes con muchos elementos, considera virtualización:

```tsx
import { createVirtualizedList } from '@/utils/performance';

// Ejemplo de uso en un componente de lista
const virtualized = createVirtualizedList(
  items,
  containerRef.current,
  50, // altura de cada item
  (item, index) => {
    const div = document.createElement('div');
    div.textContent = item.name;
    return div;
  }
);
```

---

## 5. Headers HTTP

### Configuración para Vercel

Archivo: `vercel.json`

- **Assets con hash**: Cache de 1 año (immutable)
- **HTML**: Sin cache (siempre la última versión)
- **Service Worker**: Sin cache
- **API**: Cache corto con stale-while-revalidate

### Configuración para Otros Servidores

Si usas otro servidor (Nginx, Apache, etc.), configura los headers manualmente:

**Nginx:**
```nginx
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location /sw.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

**Apache (.htaccess):**
```apache
<FilesMatch "\.(js|css|woff2?|png|jpg|jpeg|svg|gif|ico)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>

<FilesMatch "sw\.js$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
</FilesMatch>
```

---

## 6. Uso en Componentes

### Migrar Componente Existente a Stale-While-Revalidate

**Antes:**
```tsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchData().then(setData).finally(() => setLoading(false));
}, []);
```

**Después:**
```tsx
import { useStaleWhileRevalidate } from '@/hooks/useStaleWhileRevalidate';

const { data, isLoading, isRefetching } = useStaleWhileRevalidate(
  ['my-data'],
  fetchData,
  { staleTime: 30 * 1000 }
);
```

### Ejemplo Completo: CuadreGeneral Optimizado

```tsx
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { usePerformanceOptimization } from '@/hooks/usePerformanceOptimization';

export function CuadreGeneralOptimized({ dateRange }) {
  // Monitoreo de performance (solo en desarrollo)
  usePerformanceOptimization({ 
    detectBlocking: import.meta.env.DEV 
  });

  // Query con stale-while-revalidate
  const { data: cuadreData, isRefetching } = useSupabaseQuery({
    table: 'daily_cuadres_summary',
    select: '*',
    filters: { 
      session_date: formatDateForDB(dateRange.from) 
    },
    staleTime: 30 * 1000,
  });

  return (
    <div>
      {cuadreData && (
        <div>
          {/* Mostrar datos inmediatamente */}
          <div>Total: {cuadreData.total_sales_bs}</div>
        </div>
      )}
      {isRefetching && (
        <span className="text-sm text-muted-foreground">
          Actualizando en segundo plano...
        </span>
      )}
    </div>
  );
}
```

---

## 🚀 Despliegue

### Pasos para Producción

1. **Build con hash automático:**
   ```bash
   npm run build
   ```

2. **Verificar que los archivos tengan hash:**
   ```bash
   ls dist/assets/
   ```

3. **Desplegar a Vercel/Netlify:**
   - Los headers se configuran automáticamente con `vercel.json`

4. **Verificar Service Worker:**
   - Abre DevTools > Application > Service Workers
   - Debe estar registrado y activo

5. **Probar actualizaciones:**
   - Haz un cambio en el código
   - Haz build y deploy
   - El Service Worker detectará la nueva versión y recargará automáticamente

---

## 🔍 Debugging

### Verificar Cache Busting

```javascript
// En la consola del navegador
console.log('Service Worker:', navigator.serviceWorker.controller);
console.log('Cache:', await caches.keys());
```

### Verificar React Query Cache

```tsx
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();
console.log('Query Cache:', queryClient.getQueryCache().getAll());
```

### Limpiar Todo el Cache

```tsx
import { clearServiceWorkerCache } from '@/utils/serviceWorker';
import { useQueryClient } from '@tanstack/react-query';

// Limpiar Service Worker cache
await clearServiceWorkerCache();

// Limpiar React Query cache
const queryClient = useQueryClient();
queryClient.clear();
```

---

## 📊 Monitoreo

### Performance Metrics

El hook `usePerformanceOptimization` puede monitorear:

- Bloqueos del Main Thread
- Uso de memoria (Chrome/Edge)
- Frecuencia de actualizaciones

### Logs en Consola

Los logs incluyen prefijos para fácil identificación:

- `[SW]` - Service Worker
- `[Query]` - React Query
- `[Performance]` - Métricas de rendimiento

---

## ✅ Checklist de Implementación

- [x] Cache busting configurado en Vite
- [x] React Query con stale-while-revalidate
- [x] Service Worker para actualizaciones automáticas
- [x] Headers HTTP configurados
- [x] Utilidades de performance
- [x] Hooks personalizados para fácil uso
- [x] Documentación completa

---

## 🆘 Troubleshooting

### Los usuarios no ven actualizaciones

1. Verifica que el Service Worker esté registrado
2. Verifica que los archivos tengan hash en el build
3. Verifica los headers HTTP en DevTools > Network

### La app se siente lenta

1. Activa el monitoreo de performance en desarrollo
2. Revisa los logs de bloqueos del Main Thread
3. Verifica memory leaks con el monitor de memoria

### React Query no actualiza datos

1. Verifica `staleTime` y `gcTime`
2. Verifica que `refetchOnWindowFocus` esté habilitado
3. Usa `forceRefresh()` para forzar actualización manual

---

## 📚 Referencias

- [Vite Build Options](https://vitejs.dev/config/build-options.html)
- [React Query Stale-While-Revalidate](https://tanstack.com/query/latest/docs/react/guides/window-focus-refetching)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web Performance](https://web.dev/performance/)

