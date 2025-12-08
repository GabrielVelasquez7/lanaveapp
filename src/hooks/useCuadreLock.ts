import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getTodayVenezuela, formatDateForDB } from '@/lib/dateUtils';

interface UseCuadreLockOptions {
  userId?: string;
  dateRange?: { from: Date; to: Date };
  selectedAgency?: string; // Si se proporciona, no aplica bloqueo (modo encargada)
  isTaquillera?: boolean;
}

interface UseCuadreLockReturn {
  isLocked: boolean;
  isApproved: boolean;
  isCuadreClosed: boolean;
  encargadaStatus: string | null;
  sessionId: string | null;
  checkLockStatus: () => Promise<void>;
}

/**
 * Hook reutilizable para verificar si el cuadre está bloqueado.
 * Un cuadre está bloqueado cuando:
 * - El cuadre está cerrado (is_closed = true) Y
 * - NO está rechazado por la encargada
 * 
 * El cuadre se desbloquea solo cuando la encargada lo rechaza.
 */
export const useCuadreLock = ({
  userId,
  dateRange,
  selectedAgency,
  isTaquillera = true,
}: UseCuadreLockOptions): UseCuadreLockReturn => {
  const [isApproved, setIsApproved] = useState(false);
  const [isCuadreClosed, setIsCuadreClosed] = useState(false);
  const [encargadaStatus, setEncargadaStatus] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const checkLockStatus = useCallback(async () => {
    // No aplicar bloqueo si hay una agencia seleccionada (modo encargada) o no es taquillera
    if (selectedAgency || !isTaquillera || !userId) {
      setIsApproved(false);
      setIsCuadreClosed(false);
      setEncargadaStatus(null);
      setSessionId(null);
      return;
    }

    try {
      // Determinar la fecha a verificar
      const dateToCheck = dateRange 
        ? formatDateForDB(dateRange.from) 
        : getTodayVenezuela();

      // Buscar la sesión del usuario para la fecha
      const { data: session } = await supabase
        .from('daily_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('session_date', dateToCheck)
        .maybeSingle();

      if (session) {
        setSessionId(session.id);

        // Verificar el estado del cuadre
        const { data: cuadreSummary } = await supabase
          .from('daily_cuadres_summary')
          .select('encargada_status, is_closed')
          .eq('session_id', session.id)
          .maybeSingle();

        if (cuadreSummary) {
          setIsApproved(cuadreSummary.encargada_status === 'aprobado');
          setEncargadaStatus(cuadreSummary.encargada_status || null);
          setIsCuadreClosed(cuadreSummary.is_closed === true);
        } else {
          setIsApproved(false);
          setEncargadaStatus(null);
          setIsCuadreClosed(false);
        }
      } else {
        setSessionId(null);
        setIsApproved(false);
        setEncargadaStatus(null);
        setIsCuadreClosed(false);
      }
    } catch (error) {
      console.error('Error checking cuadre lock status:', error);
      setIsApproved(false);
      setIsCuadreClosed(false);
      setEncargadaStatus(null);
      setSessionId(null);
    }
  }, [userId, dateRange, selectedAgency, isTaquillera]);

  useEffect(() => {
    checkLockStatus();
  }, [checkLockStatus]);

  // Calcular si está bloqueado: cerrado Y no rechazado
  const isLocked = isCuadreClosed && encargadaStatus !== 'rechazado';

  return {
    isLocked,
    isApproved,
    isCuadreClosed,
    encargadaStatus,
    sessionId,
    checkLockStatus,
  };
};
