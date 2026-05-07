import { useEffect, useMemo, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [agencies, setAgencies] = useState<{ id: string; name: string }[]>([]);
  const [summaries, setSummaries] = useState<AgencyWeeklySummary[]>([]);

  const startStr = useMemo(() => (currentWeek ? format(currentWeek.start, "yyyy-MM-dd") : null), [currentWeek]);
  const endStr = useMemo(() => (currentWeek ? format(currentWeek.end, "yyyy-MM-dd") : null), [currentWeek]);

  const fetchAll = async () => {
    if (!startStr || !endStr) return;
    setLoading(true);
    setError(null);

    try {
      // ─────────────────────────────────────────────────────────────
      // PASO 1: Datos base — agencias, sistemas, perfiles de encargadas
      // ─────────────────────────────────────────────────────────────
      const [
        { data: agenciesData, error: agenciesError },
        { data: systems,      error: systemsError },
        { data: encargadaProfiles, error: encargadaProfilesError },
      ] = await Promise.all([
        supabase.from("agencies").select("id, name").eq("is_active", true).order("name"),
        supabase.from("lottery_systems").select("id, name").eq("is_active", true).order("name"),
        // Solo traemos perfiles con rol encargada — fuente de verdad para filtros
        supabase.from("profiles").select("user_id, agency_id").eq("role", "encargada").eq("is_active", true),
      ]);

      if (agenciesError) throw agenciesError;
      if (systemsError) throw systemsError;
      if (encargadaProfilesError) throw encargadaProfilesError;

      // Mapas de encargadas: user_id → agency_id
      const encargadaUserIds = new Set((encargadaProfiles || []).map((p: any) => p.user_id));
      const agencyByEncargadaUserId = new Map(
        (encargadaProfiles || []).map((p: any) => [p.user_id, p.agency_id])
      );

      // ─────────────────────────────────────────────────────────────
      // PASO 2: Sesiones de encargadas (para pending_prizes por sesión)
      // ─────────────────────────────────────────────────────────────
      const encargadaUserIdsList = [...encargadaUserIds];
      let encargadaSessions: any[] = [];

      if (encargadaUserIdsList.length > 0) {
        const { data: sessData, error: sessError } = await supabase
          .from("daily_sessions")
          .select("id, user_id, session_date")
          .in("user_id", encargadaUserIdsList)
          .gte("session_date", startStr)
          .lte("session_date", endStr);
        if (sessError) throw sessError;
        encargadaSessions = sessData || [];
      }

      const encargadaSessionIds = encargadaSessions.map((s: any) => s.id);
      // session_id → agency_id (para pending_prizes que vienen via sesión de encargada)
      const sessionToAgency = new Map(
        encargadaSessions
          .filter((s: any) => agencyByEncargadaUserId.has(s.user_id))
          .map((s: any) => [s.id, agencyByEncargadaUserId.get(s.user_id)])
      );
      // session_id → session_date
      const sessionToDate = new Map(
        encargadaSessions.map((s: any) => [s.id, s.session_date])
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
        .select("agency_id, session_date, total_sales_bs, total_sales_usd, total_prizes_bs, total_prizes_usd, total_banco_bs, pending_prizes, pending_prizes_usd, exchange_rate, created_at, updated_at")
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
      if (manualTotalsError) console.warn("Error fetching manual totals:", manualTotalsError);

      // Premios por pagar (tabla pending_prizes) — SOLO via sesiones de encargadas
      let pendingPrizesData: any[] = [];
      if (encargadaSessionIds.length > 0) {
        const { data: prizesData, error: prizesError } = await supabase
          .from("pending_prizes")
          .select("id, session_id, amount_bs, amount_usd, description, is_paid, created_at")
          .in("session_id", encargadaSessionIds);
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

      // Para cada agencia: construir mapa fecha → registro más reciente
      const latestByDateByAgency = new Map<string, Map<string, any>>();
      (summaryData || []).forEach((s: any) => {
        if (!latestByDateByAgency.has(s.agency_id)) {
          latestByDateByAgency.set(s.agency_id, new Map());
        }
        const byDate = latestByDateByAgency.get(s.agency_id)!;
        const existing = byDate.get(s.session_date);
        const existingTime = existing?.updated_at || existing?.created_at;
        const newTime = s.updated_at || s.created_at;
        if (!existing || (newTime && existingTime && new Date(newTime) > new Date(existingTime))) {
          byDate.set(s.session_date, s);
        }
      });

      Object.entries(byAgency).forEach(([agencyId, ag]) => {
        const byDate = latestByDateByAgency.get(agencyId);
        if (byDate) {
          const list = Array.from(byDate.values());

          // Banco total de la semana
          ag.total_banco_bs = list.reduce((sum, v: any) => sum + Number(v.total_banco_bs || 0), 0);

          // Premios por pagar registrados en el cuadre diario (campo numérico en summary)
          // La encargada los ingresa manualmente en CuadreGeneralEncargada
          ag.premios_por_pagar_bs  += list.reduce((sum, v: any) => sum + Number(v.pending_prizes     || 0), 0);
          ag.premios_por_pagar_usd += list.reduce((sum, v: any) => sum + Number(v.pending_prizes_usd || 0), 0);

          // Tasa del domingo (último día de la semana)
          const sunday = byDate.get(endStr!);
          if (sunday?.exchange_rate) {
            ag.sunday_exchange_rate = Number(sunday.exchange_rate);
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
      // PASO 11: Premios por pagar (tabla pending_prizes) via sesiones
      // de encargada. sessionToAgency ya filtra solo encargadas.
      // ─────────────────────────────────────────────────────────────
      (pendingPrizesData || []).forEach((p: any) => {
        const agencyId = sessionToAgency.get(p.session_id);
        if (!agencyId || !byAgency[agencyId]) return;

        const prizeDetail: PendingPrizeDetail = {
          id:          p.id,
          date:        sessionToDate.get(p.session_id) || p.created_at?.split("T")[0],
          amount_bs:   Number(p.amount_bs  || 0),
          amount_usd:  Number(p.amount_usd || 0),
          description: p.description || undefined,
          is_paid:     p.is_paid || false,
        };

        byAgency[agencyId].premios_por_pagar_details.push(prizeDetail);
        if (!p.is_paid) {
          byAgency[agencyId].premios_por_pagar_bs  += prizeDetail.amount_bs;
          byAgency[agencyId].premios_por_pagar_usd += prizeDetail.amount_usd;
        }
      });

      setSummaries(Object.values(byAgency));
    } catch (err: any) {
      console.error("useWeeklyCuadre error:", err);
      setError(err.message || "Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

    const { error } = await supabase.from("weekly_system_totals").upsert(upserts);
    if (error) throw new Error(error.message);
    await fetchAll();
  };

  return { loading, error, agencies, summaries, refresh: fetchAll, saveSystemTotals };
}
