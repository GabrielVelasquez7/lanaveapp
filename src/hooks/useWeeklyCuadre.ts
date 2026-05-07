import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface WeekBoundaries {
  start: Date;
  end: Date;
}

export interface PerSystemTotals {
  system_id: string;
  system_name: string;
  sales_bs: number;
  sales_usd: number;
  prizes_bs: number;
  prizes_usd: number;
  // Optional fields for manual adjustments
  is_adjusted?: boolean;
  adjusted_by?: string;
  adjusted_at?: string;
  notes?: string;
}

export interface ExpenseDetail {
  id: string;
  date: string;
  category: string;
  amount_bs: number;
  amount_usd: number;
  description?: string;
  is_paid: boolean;
}

export interface PendingPrizeDetail {
  id: string;
  date: string;
  amount_bs: number;
  amount_usd: number;
  description?: string;
  is_paid: boolean;
}

export interface AgencyWeeklySummary {
  agency_id: string;
  agency_name: string;
  total_sales_bs: number;
  total_sales_usd: number;
  total_prizes_bs: number;
  total_prizes_usd: number;
  total_cuadre_bs: number;
  total_cuadre_usd: number;
  total_deudas_bs: number;
  total_deudas_usd: number;
  total_gastos_bs: number;
  total_gastos_usd: number;
  premios_por_pagar_bs: number;
  premios_por_pagar_usd: number;
  total_banco_bs: number;
  deposit_bs: number;
  sunday_exchange_rate: number;
  per_system: PerSystemTotals[];
  gastos_details: ExpenseDetail[];
  deudas_details: ExpenseDetail[];
  premios_por_pagar_details: PendingPrizeDetail[];
  weekly_config_saved: boolean;
  weekly_config_exchange_rate?: number;
  weekly_config_cash_bs?: number;
  weekly_config_cash_usd?: number;
  weekly_config_closure_notes?: string;
  weekly_config_additional_bs?: number;
  weekly_config_additional_usd?: number;
  weekly_config_additional_notes?: string;
  weekly_config_apply_excess_usd?: boolean;
  weekly_config_excess_usd?: number;
  weekly_config_final_difference?: number;
}

interface UseWeeklyCuadreResult {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  agencies: { id: string; name: string }[];
  summaries: AgencyWeeklySummary[];
  refresh: () => Promise<void>;
  saveSystemTotals: (params: {
    agencyId: string;
    weekStart: Date;
    weekEnd: Date;
    systems: PerSystemTotals[];
    userId: string;
    notes?: string;
  }) => Promise<void>;
}

export function useWeeklyCuadre(currentWeek: WeekBoundaries | null): UseWeeklyCuadreResult {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agencies, setAgencies] = useState<{ id: string; name: string }[]>([]);
  const [summaries, setSummaries] = useState<AgencyWeeklySummary[]>([]);
  // Tracks whether the very first load for the current week has completed
  const initialLoadDone = useRef(false);

  const startStr = useMemo(() => (currentWeek ? format(currentWeek.start, "yyyy-MM-dd") : null), [currentWeek]);
  const endStr = useMemo(() => (currentWeek ? format(currentWeek.end, "yyyy-MM-dd") : null), [currentWeek]);

  const fetchAll = async () => {
    if (!startStr || !endStr) return;
    
    if (!initialLoadDone.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      // ─────────────────────────────────────────────────────────────
      // PASO 1: Datos base — agencias, sistemas, perfiles de encargadas
      // ─────────────────────────────────────────────────────────────
      const [
        { data: agenciesData, error: agenciesError },
        { data: systems,      error: systemsError },
        { data: allProfilesData, error: profilesError },
      ] = await Promise.all([
        supabase.from("agencies").select("id, name").eq("is_active", true).order("name"),
        supabase.from("lottery_systems").select("id, name").eq("is_active", true).order("name"),
        supabase.from("profiles").select("user_id, agency_id, role").eq("is_active", true),
      ]);

      if (agenciesError) throw agenciesError;
      if (systemsError) throw systemsError;
      if (profilesError) throw profilesError;

      // Mapas de usuarios
      const taquilleraUserIds = new Set((allProfilesData || []).filter((p: any) => p.role === "taquillero").map((p: any) => p.user_id));
      const agencyByUserId = new Map((allProfilesData || []).map((p: any) => [p.user_id, p.agency_id]));

      // ─────────────────────────────────────────────────────────────
      // PASO 2: Sesiones de la semana (encargadas + taquilleras)
      // Encargadas: para el total de premios (solo ellas cuentan).
      // Taquilleras: para mostrar sus premios con descripción (solo lectura).
      // ─────────────────────────────────────────────────────────────
      // Todas las sesiones de la semana
      const { data: allSessionsData, error: allSessionsError } = await supabase
        .from("daily_sessions")
        .select("id, user_id, session_date")
        .gte("session_date", startStr)
        .lte("session_date", endStr);
      if (allSessionsError) throw allSessionsError;

      const allSessions = allSessionsData || [];
      const allUserIds = [...new Set(allSessions.map((s: any) => s.user_id))];

      // Separar sesiones
      const adminAndEncargadaSessions = allSessions.filter((s: any) => !taquilleraUserIds.has(s.user_id));
      const adminAndEncargadaSessionIds = adminAndEncargadaSessions.map((s: any) => s.id);
      const adminAndEncargadaSessionSet = new Set(adminAndEncargadaSessionIds);

      // session_id → agency_id  (TODOS los usuarios, para display de premios)
      const sessionToAgencyAll = new Map(
        allSessions
          .filter((s: any) => agencyByUserId.has(s.user_id))
          .map((s: any) => [s.id, agencyByUserId.get(s.user_id)])
      );
      // session_id → session_date  (TODOS)
      const sessionToDateAll = new Map(
        allSessions.map((s: any) => [s.id, s.session_date])
      );
      // session_id → agency_id  (solo encargadas/admin, para contar totales)
      const sessionToAgency = new Map(
        adminAndEncargadaSessions
          .filter((s: any) => agencyByUserId.has(s.user_id))
          .map((s: any) => [s.id, agencyByUserId.get(s.user_id)])
      );

      // ─────────────────────────────────────────────────────────────
      // PASO 3: Detalles por sistema (encargada_cuadre_details)
      // Esta tabla SOLO la escribe VentasPremiosEncargada — siempre encargada.
      // Paginamos porque PostgREST tiene tope de 1000 filas.
      // ─────────────────────────────────────────────────────────────
      const allDetails: any[] = [];
      const PAGE_SIZE = 1000;
      let detailsPage = 0;
      let detailsError: any = null;

      while (true) {
        const from = detailsPage * PAGE_SIZE;
        const { data: pageData, error: pageError } = await supabase
          .from("encargada_cuadre_details")
          .select("agency_id, session_date, lottery_system_id, sales_bs, sales_usd, prizes_bs, prizes_usd")
          .gte("session_date", startStr)
          .lte("session_date", endStr)
          .range(from, from + PAGE_SIZE - 1);

        if (pageError) { detailsError = pageError; break; }
        if (pageData) allDetails.push(...pageData);
        if (!pageData || pageData.length < PAGE_SIZE) break;
        detailsPage++;
      }
      if (detailsError) throw detailsError;

      // ─────────────────────────────────────────────────────────────
      // PASO 4: Queries paralelas de datos de encargada
      // ─────────────────────────────────────────────────────────────

      // Resúmenes diarios de encargada:
      //   session_id IS NULL → registro hecho por la encargada (no taquillera)
      //   Contiene: total_banco_bs, pending_prizes (premios registrados en cuadre diario),
      //             exchange_rate (tasa del día)
      const summaryQuery = supabase
        .from("daily_cuadres_summary")
        .select("id, agency_id, session_date, total_sales_bs, total_sales_usd, total_prizes_bs, total_prizes_usd, total_banco_bs, pending_prizes, pending_prizes_usd, exchange_rate, notes, daily_closure_confirmed, created_at, updated_at")
        .is("session_id", null)
        .gte("session_date", startStr)
        .lte("session_date", endStr);

      // Gastos y deudas de encargada:
      //   session_id IS NULL → guardado por la encargada (GastosManagerEncargada/DeudasForm con rol encargada)
      //   Taquilleras siempre tienen session_id != null
      const gastosQuery = supabase
        .from("expenses")
        .select("id, amount_bs, amount_usd, category, agency_id, transaction_date, description, is_paid")
        .is("session_id", null)
        .gte("transaction_date", startStr)
        .lte("transaction_date", endStr);

      // Config semanal (depósito, tasa, cierre)
      const weeklyConfigQuery = supabase
        .from("weekly_cuadre_config")
        .select("agency_id, deposit_bs, exchange_rate, cash_available_bs, cash_available_usd, closure_notes, additional_amount_bs, additional_amount_usd, additional_notes, apply_excess_usd, excess_usd, final_difference")
        .eq("week_start_date", startStr)
        .eq("week_end_date", endStr);

      // Totales manuales por sistema (ajustes del admin)
      const manualTotalsQuery = supabase
        .from("weekly_system_totals")
        .select("*")
        .eq("week_start_date", startStr)
        .eq("week_end_date", endStr);

      const [
        { data: summaryData,   error: summaryError },
        { data: gastosData,    error: gastosError },
        { data: weeklyConfig,  error: weeklyConfigError },
        { data: manualTotals,  error: manualTotalsError },
      ] = await Promise.all([summaryQuery, gastosQuery, weeklyConfigQuery, manualTotalsQuery]);

      if (summaryError) throw summaryError;
      if (gastosError) throw gastosError;
      if (weeklyConfigError) throw weeklyConfigError;
      if (manualTotalsError) console.warn("[CuadreSemanal] Advertencia: error obteniendo totales manuales:", manualTotalsError);

      // Premios por pagar (tabla pending_prizes) — SOLO via sesiones de encargadas
      // Premios por pagar de TODAS las sesiones (encargadas + taquilleras).
      // Las de taquilleras se mostrarán como solo-lectura en el desplegable.
      const allSessionIds = allSessions.map((s: any) => s.id);
      let pendingPrizesData: any[] = [];
      if (allSessionIds.length > 0) {
        const { data: prizesData, error: prizesError } = await supabase
          .from("pending_prizes")
          .select("id, session_id, amount_bs, amount_usd, description, is_paid, created_at")
          .in("session_id", allSessionIds);
        if (prizesError) throw prizesError;
        pendingPrizesData = prizesData || [];
      }

      // ─────────────────────────────────────────────────────────────
      // PASO 5: Construir estructura por agencia
      // ─────────────────────────────────────────────────────────────
      setAgencies(agenciesData || []);

      const byAgency: Record<string, AgencyWeeklySummary> = {};

      (agenciesData || []).forEach((a: any) => {
        byAgency[a.id] = {
          agency_id: a.id,
          agency_name: a.name,
          total_sales_bs: 0,
          total_sales_usd: 0,
          total_prizes_bs: 0,
          total_prizes_usd: 0,
          total_cuadre_bs: 0,
          total_cuadre_usd: 0,
          total_deudas_bs: 0,
          total_deudas_usd: 0,
          total_gastos_bs: 0,
          total_gastos_usd: 0,
          premios_por_pagar_bs: 0,
          premios_por_pagar_usd: 0,
          total_banco_bs: 0,
          deposit_bs: 0,
          sunday_exchange_rate: 36,
          per_system: (systems || []).map((s: any) => ({
            system_id: s.id,
            system_name: s.name,
            sales_bs: 0,
            sales_usd: 0,
            prizes_bs: 0,
            prizes_usd: 0,
          })),
          gastos_details: [],
          deudas_details: [],
          premios_por_pagar_details: [],
          weekly_config_saved: false,
        };
      });

      // ─────────────────────────────────────────────────────────────
      // PASO 6: Acumular detalles por sistema (encargada_cuadre_details)
      // ─────────────────────────────────────────────────────────────
      (allDetails || []).forEach((d: any) => {
        const ag = byAgency[d.agency_id];
        if (!ag) return;
        const idx = ag.per_system.findIndex((s) => s.system_id === d.lottery_system_id);
        if (idx !== -1) {
          ag.per_system[idx].sales_bs  += Number(d.sales_bs  || 0);
          ag.per_system[idx].sales_usd += Number(d.sales_usd || 0);
          ag.per_system[idx].prizes_bs  += Number(d.prizes_bs  || 0);
          ag.per_system[idx].prizes_usd += Number(d.prizes_usd || 0);
        }
      });

      // Calcular totales de ventas/premios
      Object.values(byAgency).forEach((ag) => {
        ag.per_system.forEach((s) => {
          ag.total_sales_bs  += s.sales_bs;
          ag.total_sales_usd += s.sales_usd;
          ag.total_prizes_bs  += s.prizes_bs;
          ag.total_prizes_usd += s.prizes_usd;
        });
        ag.total_cuadre_bs  = ag.total_sales_bs  - ag.total_prizes_bs;
        ag.total_cuadre_usd = ag.total_sales_usd - ag.total_prizes_usd;
      });

      // ─────────────────────────────────────────────────────────────
      // PASO 7: Ajustes manuales del admin (weekly_system_totals)
      // ─────────────────────────────────────────────────────────────
      if (manualTotals && manualTotals.length > 0) {
        Object.values(byAgency).forEach((ag) => {
          const agencyManual = manualTotals.filter((m: any) => m.agency_id === ag.agency_id);
          if (agencyManual.length === 0) return;

          ag.per_system = ag.per_system.map((sys) => {
            const manual = agencyManual.find((m: any) => m.lottery_system_id === sys.system_id);
            if (!manual) return sys;
            return {
              ...sys,
              sales_bs:  Number(manual.sales_bs  || 0),
              sales_usd: Number(manual.sales_usd || 0),
              prizes_bs:  Number(manual.prizes_bs  || 0),
              prizes_usd: Number(manual.prizes_usd || 0),
              is_adjusted: true,
              adjusted_by: manual.adjusted_by,
              adjusted_at: manual.adjusted_at,
              notes: manual.notes,
            } as any;
          });

          // Recalcular totales tras ajustes
          ag.total_sales_bs = ag.total_sales_usd = ag.total_prizes_bs = ag.total_prizes_usd = 0;
          ag.per_system.forEach((s) => {
            ag.total_sales_bs  += s.sales_bs;
            ag.total_sales_usd += s.sales_usd;
            ag.total_prizes_bs  += s.prizes_bs;
            ag.total_prizes_usd += s.prizes_usd;
          });
          ag.total_cuadre_bs  = ag.total_sales_bs  - ag.total_prizes_bs;
          ag.total_cuadre_usd = ag.total_sales_usd - ag.total_prizes_usd;
        });
      }

      // ─────────────────────────────────────────────────────────────
      // PASO 8: Fallback — si no hay encargada_cuadre_details para una
      // agencia, usar los totales de daily_cuadres_summary (session_id=null)
      // ─────────────────────────────────────────────────────────────
      Object.values(byAgency).forEach((ag) => {
        if (ag.total_sales_bs === 0 && ag.total_sales_usd === 0) {
          (summaryData || [])
            .filter((s: any) => s.agency_id === ag.agency_id)
            .forEach((s: any) => {
              ag.total_sales_bs  += Number(s.total_sales_bs  || 0);
              ag.total_sales_usd += Number(s.total_sales_usd || 0);
              ag.total_prizes_bs  += Number(s.total_prizes_bs  || 0);
              ag.total_prizes_usd += Number(s.total_prizes_usd || 0);
            });
          ag.total_cuadre_bs  = ag.total_sales_bs  - ag.total_prizes_bs;
          ag.total_cuadre_usd = ag.total_sales_usd - ag.total_prizes_usd;
        }
      });

      // ─────────────────────────────────────────────────────────────
      // PASO 9: Banco, tasa del domingo y premios desde daily_cuadres_summary
      // Solo registros con session_id = null (encargada)
      // ─────────────────────────────────────────────────────────────

      // Agrupar por agencia → fecha → LISTA de registros (session_id=null).
      // Puede haber dos registros por agencia/fecha:
      //   1. VentasPremiosEncargada → pending_prizes=0, contiene ventas/premios
      //   2. CuadreGeneralEncargada → pending_prizes=X, es el cierre diario
      // Tomar solo el más reciente pierde los premios si VentasPremios se guardó después.
      const allByDateByAgency = new Map<string, Map<string, any[]>>();
      (summaryData || []).forEach((s: any) => {
        if (!allByDateByAgency.has(s.agency_id)) allByDateByAgency.set(s.agency_id, new Map());
        const byDate = allByDateByAgency.get(s.agency_id)!;
        if (!byDate.has(s.session_date)) byDate.set(s.session_date, []);
        byDate.get(s.session_date)!.push(s);
      });

      Object.entries(byAgency).forEach(([agencyId, ag]) => {
        const byDate = allByDateByAgency.get(agencyId);
        if (byDate) {
          byDate.forEach((records, _date) => {
            // Banco: usar el registro de cierre si existe, si no el más reciente
            const closureRecord = records.find((r: any) => r.daily_closure_confirmed);
            const latestRecord  = records.reduce((prev: any, r: any) => {
              const pt = prev?.updated_at || prev?.created_at;
              const rt = r.updated_at || r.created_at;
              return (!prev || (rt && pt && new Date(rt) > new Date(pt))) ? r : prev;
            }, null);
            const canon = closureRecord || latestRecord;
            if (canon) ag.total_banco_bs += Number(canon.total_banco_bs || 0);

            // Premios: SUMAR de todos los registros del día para esa agencia.
            // El valor real estará en el registro del cierre (CuadreGeneralEncargada).
            const dayPremiosBs  = records.reduce((sum: number, r: any) => sum + Number(r.pending_prizes     || 0), 0);
            const dayPremiosUsd = records.reduce((sum: number, r: any) => sum + Number(r.pending_prizes_usd || 0), 0);

            // Leer estado de pago y descripción del campo notes JSON.
            // El canon es el registro de cierre (daily_closure_confirmed) o el más reciente.
            const canonNotes = (() => {
              try { return JSON.parse((canon || records[0])?.notes || "{}"); } catch { return {}; }
            })();
            const isSummaryPaid = canonNotes.pendingPrizesPaid === true;
            const summaryDescription = canonNotes.pendingPrizesDescription || "Premio registrado en cuadre diario";

            // Solo contar en totales si el premio no está marcado como pagado
            if (!isSummaryPaid) {
              ag.premios_por_pagar_bs  += dayPremiosBs;
              ag.premios_por_pagar_usd += dayPremiosUsd;
            }

            // Generar entrada sintética para el desplegable (PendingPrizesTable).
            // ID con '::' como separador para parsear agencyId (UUID con guiones) y fecha.
            if (dayPremiosBs > 0 || dayPremiosUsd > 0) {
              const dateRecord = canon || records[0];
              ag.premios_por_pagar_details.push({
                id:          `summary::${agencyId}::${dateRecord?.session_date || _date}`,
                date:        dateRecord?.session_date || _date,
                amount_bs:   dayPremiosBs,
                amount_usd:  dayPremiosUsd,
                description: summaryDescription,
                is_paid:     isSummaryPaid,
              });
            }
          });

          // Tasa del domingo — del cierre o más reciente
          const sundayRecords = byDate.get(endStr!);
          if (sundayRecords) {
            const sundayClosure = sundayRecords.find((r: any) => r.daily_closure_confirmed);
            const sundayLatest  = sundayRecords.reduce((prev: any, r: any) => {
              const pt = prev?.updated_at || prev?.created_at;
              const rt = r.updated_at || r.created_at;
              return (!prev || (rt && pt && new Date(rt) > new Date(pt))) ? r : prev;
            }, null);
            const sundayCanon = sundayClosure || sundayLatest;
            if (sundayCanon?.exchange_rate) ag.sunday_exchange_rate = Number(sundayCanon.exchange_rate);
          }
        }

        // Depósito y configuración de cierre semanal
        const depositByAgency = new Map<string, number>();
        const weeklyConfigByAgency = new Map<string, any>();
        (weeklyConfig || []).forEach((row: any) => {
          if (!row?.agency_id) return;
          depositByAgency.set(row.agency_id, Number(row.deposit_bs || 0));
          weeklyConfigByAgency.set(row.agency_id, row);
        });

        ag.deposit_bs = depositByAgency.get(agencyId) ?? 0;
        const cfg = weeklyConfigByAgency.get(agencyId);
        if (cfg) {
          ag.weekly_config_saved             = true;
          ag.weekly_config_exchange_rate     = Number(cfg.exchange_rate      ?? 0);
          ag.weekly_config_cash_bs           = Number(cfg.cash_available_bs  ?? 0);
          ag.weekly_config_cash_usd          = Number(cfg.cash_available_usd ?? 0);
          ag.weekly_config_closure_notes     = cfg.closure_notes    || "";
          ag.weekly_config_additional_bs     = Number(cfg.additional_amount_bs  ?? 0);
          ag.weekly_config_additional_usd    = Number(cfg.additional_amount_usd ?? 0);
          ag.weekly_config_additional_notes  = cfg.additional_notes || "";
          ag.weekly_config_apply_excess_usd  = cfg.apply_excess_usd ?? true;
          ag.weekly_config_excess_usd        = Number(cfg.excess_usd        ?? 0);
          ag.weekly_config_final_difference  = Number(cfg.final_difference  ?? 0);
        }
      });

      // ─────────────────────────────────────────────────────────────
      // PASO 10: Gastos y Deudas de encargada (session_id = null)
      // ─────────────────────────────────────────────────────────────
      (gastosData || []).forEach((e: any) => {
        const ag = byAgency[e.agency_id];
        if (!ag) return;

        const detail: ExpenseDetail = {
          id:          e.id,
          date:        e.transaction_date,
          category:    e.category,
          amount_bs:   Number(e.amount_bs  || 0),
          amount_usd:  Number(e.amount_usd || 0),
          description: e.description || undefined,
          is_paid:     e.is_paid || false,
        };

        if (e.category === "deuda") {
          ag.deudas_details.push(detail);
          if (!e.is_paid) {
            ag.total_deudas_bs  += detail.amount_bs;
            ag.total_deudas_usd += detail.amount_usd;
          }
        } else if (e.category === "gasto_operativo") {
          ag.gastos_details.push(detail);
          if (!e.is_paid) {
            ag.total_gastos_bs  += detail.amount_bs;
            ag.total_gastos_usd += detail.amount_usd;
          }
        }
      });

      // ─────────────────────────────────────────────────────────────
      // PASO 11: Premios por pagar (tabla pending_prizes).
      // Encargadas: se cuentan en el total.
      // Taquilleras: solo se muestran en el detalle (solo lectura).
      // ─────────────────────────────────────────────────────────────
      (pendingPrizesData || []).forEach((p: any) => {
        const agencyId = sessionToAgencyAll.get(p.session_id);
        if (!agencyId || !byAgency[agencyId]) return;

        const isEncargada = adminAndEncargadaSessionSet.has(p.session_id);

        const prizeDetail: PendingPrizeDetail = {
          id:          p.id,
          date:        sessionToDateAll.get(p.session_id) || p.created_at?.split("T")[0],
          amount_bs:   Number(p.amount_bs  || 0),
          amount_usd:  Number(p.amount_usd || 0),
          description: p.description || undefined,
          is_paid:     p.is_paid || false,
          readOnly:    false,
        };

        byAgency[agencyId].premios_por_pagar_details.push(prizeDetail);
        // Solo contar en totales si es de encargada y no está pagado
        if (isEncargada && !p.is_paid) {
          byAgency[agencyId].premios_por_pagar_bs  += prizeDetail.amount_bs;
          byAgency[agencyId].premios_por_pagar_usd += prizeDetail.amount_usd;
        }
      });

      setSummaries(Object.values(byAgency));
    } catch (err: any) {
      console.error("[CuadreSemanal] Error general cargando datos:", err);
      setError(err.message || "Error cargando datos");
    } finally {
      setLoading(false);
      setRefreshing(false);
      initialLoadDone.current = true;
    }
  };

  useEffect(() => {
    initialLoadDone.current = false;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startStr, endStr]);

  const saveSystemTotals = async (params: {
    agencyId: string;
    weekStart: Date;
    weekEnd: Date;
    systems: PerSystemTotals[];
    userId: string;
    notes?: string;
  }) => {
    const { agencyId, weekStart, weekEnd, systems, userId, notes } = params;
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const weekEndStr   = format(weekEnd,   "yyyy-MM-dd");

    const upserts = systems.map((sys) => ({
      agency_id:        agencyId,
      week_start_date:  weekStartStr,
      week_end_date:    weekEndStr,
      lottery_system_id: sys.system_id,
      sales_bs:   sys.sales_bs,
      sales_usd:  sys.sales_usd,
      prizes_bs:  sys.prizes_bs,
      prizes_usd: sys.prizes_usd,
      adjusted_by: userId,
      adjusted_at: new Date().toISOString(),
      notes: notes || null,
    }));

    const { error } = await supabase
      .from("weekly_system_totals")
      .upsert(upserts, { onConflict: "agency_id,week_start_date,lottery_system_id" });
    if (error) throw new Error(error.message);
    await fetchAll();
  };

  return { loading, refreshing, error, agencies, summaries, refresh: fetchAll, saveSystemTotals };
}
