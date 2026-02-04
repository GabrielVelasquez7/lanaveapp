/**
 * Hook personalizado para implementar estrategia stale-while-revalidate
 * Muestra datos en caché inmediatamente mientras actualiza en segundo plano
 */
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

interface StaleWhileRevalidateOptions<TData, TError> extends Omit<UseQueryOptions<TData, TError>, 'staleTime' | 'gcTime'> {
  /**
   * Tiempo en ms antes de que los datos se consideren stale (default: 30s)
   */
  staleTime?: number;
  /**
   * Tiempo en ms que los datos permanecen en caché (default: 5min)
   */
  gcTime?: number;
  /**
   * Si es true, siempre muestra datos en caché primero (stale-while-revalidate puro)
   */
  alwaysShowStale?: boolean;
  /**
   * Callback cuando se detectan datos actualizados
   */
  onDataUpdated?: (data: TData) => void;
}

export function useStaleWhileRevalidate<TData = unknown, TError = Error>(
  queryKey: string[],
  queryFn: () => Promise<TData>,
  options?: StaleWhileRevalidateOptions<TData, TError>
) {
  const {
    staleTime = 30 * 1000, // 30 segundos
    gcTime = 5 * 60 * 1000, // 5 minutos
    alwaysShowStale = true,
    onDataUpdated,
    ...restOptions
  } = options || {};

  const previousDataRef = useRef<TData | undefined>(undefined);
  const isInitialMount = useRef(true);

  const query = useQuery<TData, TError>({
    queryKey,
    queryFn,
    staleTime,
    gcTime,
    // Mostrar datos en caché mientras se actualiza
    placeholderData: alwaysShowStale ? (previousData) => previousData : undefined,
    // Refrescar en segundo plano sin mostrar loading
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    ...restOptions,
  });

  // Detectar cuando los datos cambian y notificar
  if (query.data !== undefined && query.data !== previousDataRef.current) {
    if (!isInitialMount.current && onDataUpdated) {
      onDataUpdated(query.data);
    }
    previousDataRef.current = query.data;
    isInitialMount.current = false;
  }

  // Función para forzar actualización manual
  const forceRefresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    ...query,
    // Datos siempre disponibles (stale o fresh)
    data: query.data ?? previousDataRef.current,
    // Indica si hay datos frescos
    isStale: query.isStale,
    // Indica si se está actualizando en segundo plano
    isRefetching: query.isRefetching,
    // Función para refrescar manualmente
    forceRefresh,
  };
}

