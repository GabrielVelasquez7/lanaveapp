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
  isLoadingLock: boolean;
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
  const [isLoadingLock, setIsLoadingLock] = useState(false);

  const checkLockStatus = useCallback(async () => {
    // No aplicar bloqueo si hay una agencia seleccionada (modo encargada) o no es taquillera
    if (selectedAgency || !isTaquillera || !userId) {
      setIsApproved(false);
      setIsCuadreClosed(false);
      setEncargadaStatus(null);
      setSessionId(null);
      setIsLoadingLock(false);
      return;
    }

    setIsLoadingLock(true);
    try {
      // Determinar la fecha a verificar
      const dateToCheck = dateRange 
        ? formatDateForDB(dateRange.from) 
        : getTodayVenezuela();

      // Buscar la sesión del usuario para la fecha
      const { data: session } = await supabase
        .from('daily_sessions')
        .select('id, daily_closure_confirmed')
        .eq('user_id', userId)
        .eq('session_date', dateToCheck)
        .maybeSingle();

      if (session) {
        setSessionId(session.id);
        const isSessionClosed = session.daily_closure_confirmed === true;

        // Verificar el estado del cuadre
        const { data: cuadreSummary } = await supabase
          .from('daily_cuadres_summary')
          .select('encargada_status, is_closed')
          .eq('session_id', session.id)
          .maybeSingle();

        if (cuadreSummary) {
          setIsApproved(cuadreSummary.encargada_status === 'aprobado');
          setEncargadaStatus(cuadreSummary.encargada_status || null);
          setIsCuadreClosed(isSessionClosed || cuadreSummary.is_closed === true);
        } else {
          setIsApproved(false);
          setEncargadaStatus(null);
          setIsCuadreClosed(isSessionClosed);
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
    } finally {
      setIsLoadingLock(false);
    }
  }, [userId, dateRange, selectedAgency, isTaquillera]);

  useEffect(() => {
    checkLockStatus();
  }, [checkLockStatus]);

  // Calcular si está bloqueado: cerrado Y no rechazado
  // O si está cargando, bloqueamos preventivamente para evitar "parpadeos" en los inputs
  const isLocked = isLoadingLock || (isCuadreClosed && encargadaStatus !== 'rechazado');

  return {
    isLocked,
    isApproved,
    isCuadreClosed,
    encargadaStatus,
    sessionId,
    isLoadingLock,
    checkLockStatus,
  };
};
