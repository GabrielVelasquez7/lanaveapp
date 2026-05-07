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
  const [isAgencyApprovedState, setIsAgencyApprovedState] = useState(false);
  const dateToCheck = dateRange
    ? formatDateForDB(dateRange.from)
    : getTodayVenezuela();

  const checkLockStatus = useCallback(async () => {
    // No aplicar bloqueo si hay una agencia seleccionada (modo encargada) o no es taquillera
    if (selectedAgency || !isTaquillera || !userId) {
      setIsApproved(false);
      setIsCuadreClosed(false);
      setEncargadaStatus(null);
      setSessionId(null);
      setIsAgencyApprovedState(false);
      setIsLoadingLock(false);
      return;
    }

    setIsLoadingLock(true);
    try {
      // Buscar el profile para tener el agency_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('user_id', userId)
        .single();

      const agencyId = profile?.agency_id;

      // Buscar si la encargada ya cerró y aprobó todo el día para la agencia
      let isAgencyApproved = false;
      if (agencyId) {
        const { data: encargadaSummary } = await supabase
          .from('daily_cuadres_summary')
          .select('encargada_status, is_closed')
          .eq('agency_id', agencyId)
          .eq('session_date', dateToCheck)
          .is('session_id', null)
          .maybeSingle();

        // Solo bloquear a nivel de agencia cuando la encargada efectivamente cerró el cuadre del día.
        // 'pendiente' es el valor por defecto del campo, así que no es señal suficiente por sí solo:
        // exigimos también is_closed = true. Si está 'rechazado', no bloquea.
        const status = encargadaSummary?.encargada_status;
        isAgencyApproved =
          encargadaSummary?.is_closed === true &&
          (status === 'aprobado' || status === 'pendiente');
      }

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
          setIsApproved(isAgencyApproved || cuadreSummary.encargada_status === 'aprobado');
          setEncargadaStatus(cuadreSummary.encargada_status || null);
          setIsCuadreClosed(isAgencyApproved || isSessionClosed || cuadreSummary.is_closed === true);
        } else {
          setIsApproved(isAgencyApproved);
          setEncargadaStatus(null);
          setIsCuadreClosed(isAgencyApproved || isSessionClosed);
        }
      } else {
        setSessionId(null);
        setIsApproved(isAgencyApproved);
        setEncargadaStatus(null);
        setIsCuadreClosed(isAgencyApproved);
      }
      setIsAgencyApprovedState(isAgencyApproved);
    } catch (error) {
      console.error('[Cuadre] Error verificando estado de bloqueo:', error);
      setIsApproved(false);
      setIsCuadreClosed(false);
      setEncargadaStatus(null);
      setSessionId(null);
      setIsAgencyApprovedState(false);
    } finally {
      setIsLoadingLock(false);
    }
  }, [userId, dateToCheck, selectedAgency, isTaquillera]);

  useEffect(() => {
    checkLockStatus();
  }, [checkLockStatus]);

  // Calcular si está bloqueado: cerrado Y no rechazado
  // O si está cargando, bloqueamos preventivamente para evitar "parpadeos" en los inputs
  // O si la agencia entera está aprobada/pendiente
  const isLocked = isLoadingLock || isAgencyApprovedState || (isCuadreClosed && encargadaStatus !== 'rechazado');

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
