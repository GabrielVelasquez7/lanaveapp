/**
 * Hook para optimización de rendimiento
 * Detecta memory leaks y bloqueos del Main Thread
 */
import { useEffect, useRef } from 'react';
import { detectMainThreadBlocking, monitorMemoryUsage } from '@/utils/performance';

interface UsePerformanceOptimizationOptions {
  /**
   * Habilitar detección de bloqueos del Main Thread
   */
  detectBlocking?: boolean;
  /**
   * Habilitar monitoreo de memoria (solo Chrome/Edge)
   */
  monitorMemory?: boolean;
  /**
   * Threshold en ms para considerar bloqueo (default: 50ms)
   */
  blockingThreshold?: number;
}

export function usePerformanceOptimization(
  options: UsePerformanceOptimizationOptions = {}
) {
  const {
    detectBlocking = false,
    monitorMemory = false,
    blockingThreshold = 50,
  } = options;

  const blockingMonitorRef = useRef<ReturnType<typeof detectMainThreadBlocking> | null>(null);
  const memoryMonitorRef = useRef<ReturnType<typeof monitorMemoryUsage> | null>(null);

  useEffect(() => {
    // Solo en desarrollo o si está explícitamente habilitado
    const isDev = import.meta.env.DEV;
    if (!isDev && !detectBlocking && !monitorMemory) {
      return;
    }

    if (detectBlocking) {
      blockingMonitorRef.current = detectMainThreadBlocking(blockingThreshold);
    }

    if (monitorMemory) {
      memoryMonitorRef.current = monitorMemoryUsage();
    }

    return () => {
      if (blockingMonitorRef.current) {
        blockingMonitorRef.current.reset();
      }
      if (memoryMonitorRef.current) {
        memoryMonitorRef.current.stop();
      }
    };
  }, [detectBlocking, monitorMemory, blockingThreshold]);

  return {
    getBlockedCount: () => blockingMonitorRef.current?.getBlockedCount() ?? 0,
    getMemoryUsage: () => memoryMonitorRef.current?.getCurrentUsage() ?? null,
  };
}

