/**
 * Hook especializado para queries de Supabase con stale-while-revalidate
 * Ejemplo de uso con React Query optimizado
 */
import { useStaleWhileRevalidate } from './useStaleWhileRevalidate';
import { supabase } from '@/integrations/supabase/client';

interface UseSupabaseQueryOptions {
  table: string;
  select?: string;
  filters?: Record<string, unknown>;
  staleTime?: number;
  gcTime?: number;
}

/**
 * Hook para hacer queries a Supabase con stale-while-revalidate
 * 
 * @example
 * ```tsx
 * const { data, isLoading, isRefetching, forceRefresh } = useSupabaseQuery({
 *   table: 'daily_cuadres_summary',
 *   select: '*',
 *   filters: { session_date: '2024-01-01' },
 *   staleTime: 30 * 1000, // 30 segundos
 * });
 * ```
 */
export function useSupabaseQuery<T = Record<string, unknown>>(options: UseSupabaseQueryOptions) {
  const { table, select = '*', filters = {}, staleTime, gcTime } = options;

  return useStaleWhileRevalidate<T[]>(
    ['supabase', table, select, JSON.stringify(filters)],
    async () => {
      // Using 'any' here because Supabase's dynamic table selection requires it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from as any)(table).select(select);

      // Aplicar filtros
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else if (typeof value === 'string' && value.includes('%')) {
            query = query.like(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
      });

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return (data ?? []) as T[];
    },
    {
      staleTime,
      gcTime,
      alwaysShowStale: true,
      onDataUpdated: (data) => {
        // Opcional: notificar cuando hay datos actualizados
        console.log(`[Query] Datos actualizados para ${table}:`, data.length, 'registros');
      },
    }
  );
}

