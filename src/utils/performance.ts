/**
 * Utilidades para optimización de rendimiento
 * Detecta memory leaks, bloqueos del Main Thread y optimiza renderizado
 */

/**
 * Limpia event listeners y suscripciones para prevenir memory leaks
 */
export function createCleanupManager() {
  const cleanupFunctions: Array<() => void> = [];

  return {
    add: (cleanup: () => void) => {
      cleanupFunctions.push(cleanup);
    },
    cleanup: () => {
      cleanupFunctions.forEach((fn) => {
        try {
          fn();
        } catch (error) {
          console.error('Error en cleanup:', error);
        }
      });
      cleanupFunctions.length = 0;
    },
  };
}

/**
 * Debounce para evitar llamadas excesivas
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle para limitar frecuencia de ejecución
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Usa requestIdleCallback si está disponible, sino usa setTimeout
 */
export function scheduleIdleTask(callback: () => void, timeout = 5000) {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(id);
  } else {
    const id = setTimeout(callback, timeout);
    return () => clearTimeout(id);
  }
}

/**
 * Usa requestAnimationFrame para tareas de renderizado
 */
export function scheduleAnimationTask(callback: () => void) {
  const id = requestAnimationFrame(callback);
  return () => cancelAnimationFrame(id);
}

/**
 * Detecta si el Main Thread está bloqueado
 */
export function detectMainThreadBlocking(threshold = 50) {
  let lastTime = performance.now();
  let blockedCount = 0;

  const checkBlocking = () => {
    const currentTime = performance.now();
    const delta = currentTime - lastTime;

    // Si el delta es mayor al threshold, el thread está bloqueado
    if (delta > threshold) {
      blockedCount++;
      console.warn(`[Performance] Main Thread bloqueado por ${delta.toFixed(2)}ms`);
      
      if (blockedCount > 10) {
        console.error('[Performance] Múltiples bloqueos detectados. Considera optimizar el renderizado.');
      }
    }

    lastTime = currentTime;
    requestAnimationFrame(checkBlocking);
  };

  requestAnimationFrame(checkBlocking);

  return {
    getBlockedCount: () => blockedCount,
    reset: () => {
      blockedCount = 0;
      lastTime = performance.now();
    },
  };
}

/**
 * Monitorea el uso de memoria (solo en Chrome/Edge)
 */
export function monitorMemoryUsage() {
  if (!('memory' in performance)) {
    console.warn('[Performance] Memory API no disponible');
    return null;
  }

  const memory = (performance as any).memory;
  const formatBytes = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const logMemory = () => {
    console.log('[Performance] Memoria:', {
      used: formatBytes(memory.usedJSHeapSize),
      total: formatBytes(memory.totalJSHeapSize),
      limit: formatBytes(memory.jsHeapSizeLimit),
    });

    // Alerta si el uso es mayor al 80% del límite
    const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    if (usagePercent > 80) {
      console.warn(`[Performance] Uso de memoria alto: ${usagePercent.toFixed(2)}%`);
    }
  };

  // Log cada 30 segundos
  const interval = setInterval(logMemory, 30000);
  logMemory(); // Log inmediato

  return {
    stop: () => clearInterval(interval),
    getCurrentUsage: () => ({
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
    }),
  };
}

/**
 * Virtualiza listas largas usando Intersection Observer
 * Útil para componentes con muchos elementos
 */
export function createVirtualizedList<T>(
  items: T[],
  containerElement: HTMLElement | null,
  itemHeight: number,
  renderItem: (item: T, index: number) => HTMLElement
) {
  if (!containerElement) return null;

  const containerHeight = containerElement.clientHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight) + 2; // +2 para buffer
  const scrollTop = containerElement.scrollTop;
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount, items.length);

  const visibleItems = items.slice(startIndex, endIndex);

  return {
    visibleItems,
    startIndex,
    endIndex,
    totalHeight: items.length * itemHeight,
    offsetY: startIndex * itemHeight,
  };
}

/**
 * Lazy load de imágenes
 */
export function lazyLoadImage(imgElement: HTMLImageElement, src: string) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          imgElement.src = src;
          observer.unobserve(imgElement);
        }
      });
    },
    { rootMargin: '50px' }
  );

  observer.observe(imgElement);

  return () => observer.unobserve(imgElement);
}

