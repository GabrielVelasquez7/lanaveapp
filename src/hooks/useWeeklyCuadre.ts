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
  // Totales por la semana
  total_sales_bs: number;
  total_sales_usd: number;
  total_prizes_bs: number;
  total_prizes_usd: number;
  total_cuadre_bs: number;  // Ventas - Premios en Bs
  total_cuadre_usd: number; // Ventas - Premios en USD
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
  // Campos del cierre semanal de la encargada
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
      // Paginación para encargada_cuadre_details:
      // Supabase/PostgREST tiene max-rows=1000 en el servidor y no se puede sobrepasar con .limit().
      // La única forma es paginar con .range() hasta obtener todos los datos.
      const allDetails: any[] = [];
      const PAGE_SIZE = 1000;
      let detailsPage = 0;
      let detailsError: any = null;
      while (true) {
        const from = detailsPage * PAGE_SIZE;
        const { data: pageData, error: pageError } = await supabase
          .from("encargada_cuadre_details")
          .select("agency_id, session_date, lottery_system_id, sales_bs, sales_usd, prizes_bs, prizes_usd, user_id")
          .gte("session_date", startStr)
          .lte("session_date", endStr)
          .range(from, from + PAGE_SIZE - 1);

        if (pageError) { detailsError = pageError; break; }
        if (pageData) allDetails.push(...pageData);
        if (!pageData || pageData.length < PAGE_SIZE) break; // última página
        detailsPage++;
      }

      // Fetch sessions first so we can filter profiles by relevant user_ids only
      const { data: sessions, error: sessionsError } = await supabase
        .from("daily_sessions")
        .select("id, user_id, session_date")
        .gte("session_date", startStr)
        .lte("session_date", endStr)
        .limit(2000); // safety: 1000-row cap protection

      if (sessionsError) throw sessionsError;

      // Fetch profiles only for users who have sessions in this week (optimization)
      const weekUserIds = [...new Set((sessions || []).map((s: any) => s.user_id))];
      const profilesQuery = weekUserIds.length > 0
        ? supabase.from("profiles").select("user_id, agency_id, role").in("user_id", weekUserIds)
        : supabase.from("profiles").select("user_id, agency_id, role").limit(0);

      const [
        { data: agenciesData, error: agenciesError },
        { data: systems, error: systemsError },
        { data: summaryData, error: summaryError },
        { data: profiles, error: profilesError },
        { data: weeklyConfig, error: weeklyConfigError },
      ] = await Promise.all([
        supabase.from("agencies").select("id,name").eq("is_active", true).order("name"),
        supabase.from("lottery_systems").select("id,name").eq("is_active", true).order("name"),
        supabase
          .from("daily_cuadres_summary")
          .select(
            "agency_id, session_date, total_sales_bs, total_sales_usd, total_prizes_bs, total_prizes_usd, total_banco_bs, pending_prizes, pending_prizes_usd, exchange_rate, created_at, updated_at, user_id"
          )
          .is("session_id", null)
          .gte("session_date", startStr)
          .lte("session_date", endStr),
        profilesQuery,
        supabase
          .from("weekly_cuadre_config")
          .select("agency_id, deposit_bs, exchange_rate, cash_available_bs, cash_available_usd, closure_notes, additional_amount_bs, additional_amount_usd, additional_notes, apply_excess_usd, excess_usd, final_difference")
          .eq("week_start_date", startStr)
          .eq("week_end_date", endStr),
      ]);

      // También consultar user_roles para identificar encargadas (fuente de verdad)
      // ya que profiles.role puede estar desactualizado.
      const detailUserIds = [...new Set(allDetails.map((d: any) => d.user_id).filter(Boolean))];
      const allRelevantUserIds = [...new Set([...(weekUserIds as string[]), ...detailUserIds])];
      const { data: userRolesData, error: userRolesError } = allRelevantUserIds.length > 0
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", allRelevantUserIds)
        : { data: [] as any[], error: null };
      if (userRolesError) throw userRolesError;

      if (agenciesError) throw agenciesError;
      if (detailsError) throw detailsError;
      if (systemsError) throw systemsError;
      if (summaryError) throw summaryError;
      if (sessionsError) throw sessionsError;
      if (profilesError) throw profilesError;
      if (weeklyConfigError) throw weeklyConfigError;

      const depositByAgency = new Map<string, number>();
      const weeklyConfigByAgency = new Map<string, any>();
      (weeklyConfig || []).forEach((row: any) => {
        if (!row?.agency_id) return;
        depositByAgency.set(row.agency_id, Number(row.deposit_bs || 0));
        weeklyConfigByAgency.set(row.agency_id, row);
      });

      // Obtener IDs de sesiones para buscar gastos
      const sessionIds = (sessions || []).map(s => s.id);

      // Buscar gastos: por transaction_date O por session_id de sesiones en el rango
      const expenseQueries = [
        // Gastos con transaction_date en el rango (registrados por encargada con fecha explícita)
        supabase
          .from("expenses")
          .select("id, amount_bs, amount_usd, category, session_id, agency_id, transaction_date, description, is_paid")
          .gte("transaction_date", startStr)
          .lte("transaction_date", endStr),
      ];

      // Gastos por session_id (registrados por taquilleras)
      if (sessionIds.length > 0) {
        expenseQueries.push(
          supabase
            .from("expenses")
            .select("id, amount_bs, amount_usd, category, session_id, agency_id, transaction_date, description, is_paid")
            .in("session_id", sessionIds)
        );
      }

      const expenseResults = await Promise.all(expenseQueries);

      // Consolidar gastos y eliminar duplicados
      const allExpenses: any[] = [];
      expenseResults.forEach(result => {
        if (result.error) throw result.error;
        if (result.data) allExpenses.push(...result.data);
      });
      const expenses = Array.from(new Map(allExpenses.map(e => [e.id, e])).values());

      // Buscar premios por pagar SOLO de sesiones de encargadas (no taquilleras)
      // Usamos user_roles como fuente de verdad (profiles.role puede estar obsoleto).
      const encargadaUserIds = new Set(
        (userRolesData || []).filter((r: any) => r.role === 'encargada').map((r: any) => r.user_id)
      );

      // Filtrar encargada_cuadre_details para excluir cualquier registro de taquilleras
      // (la tabla solo debería tener datos de encargadas, pero esta es una salvaguarda)
      const encargadaDetails = allDetails.filter(
        (d: any) => !d.user_id || encargadaUserIds.has(d.user_id)
      );

      const encargadaSessionIds = (sessions || [])
        .filter((s: any) => encargadaUserIds.has(s.user_id))
        .map((s: any) => s.id);

      let pendingPrizesData: any[] = [];
      if (encargadaSessionIds.length > 0) {
        const { data: prizesData, error: prizesError } = await supabase
          .from("pending_prizes")
          .select("id, session_id, amount_bs, amount_usd, description, is_paid, created_at")
          .in("session_id", encargadaSessionIds);

        if (prizesError) throw prizesError;
        pendingPrizesData = prizesData || [];
      }

      // Duplicated error checks removed (already checked above)

      setAgencies(agenciesData || []);

      // DEBUG: encargada_cuadre_details rows per agency after pagination (solo encargadas)
      const detailRowsByAgencyId: Record<string, number> = {};
      encargadaDetails.forEach((d: any) => { detailRowsByAgencyId[d.agency_id] = (detailRowsByAgencyId[d.agency_id] || 0) + 1; });
      const agencyNameById = new Map((agenciesData || []).map((a: any) => [a.id, a.name]));
      const detailRowsByName: Record<string, number> = {};
      Object.entries(detailRowsByAgencyId).forEach(([id, count]) => {
        detailRowsByName[(agencyNameById.get(id) as string) || id] = count;
      });
      console.log("[DEBUG] encargada_cuadre_details (solo encargadas) total:", encargadaDetails.length, "por agencia:", detailRowsByName);

      // Mapa sistema -> nombre
      const systemNameById = new Map<string, string>();
      systems?.forEach((s) => systemNameById.set(s.id, s.name));

      // Sesion -> Agencia (para gastos sin agency_id)
      const sessionToAgency = new Map<string, string>();
      // Sesion -> Fecha (para premios por pagar)
      const sessionToDate = new Map<string, string>();
      sessions?.forEach((s) => {
        const profile = profiles?.find((p) => p.user_id === s.user_id);
        if (profile?.agency_id) sessionToAgency.set(s.id, profile.agency_id);
        sessionToDate.set(s.id, s.session_date);
      });

      // Construir por agencia
      const byAgency: Record<string, AgencyWeeklySummary> = {};

      // Base por agencia - Inicializar TODOS los sistemas con 0
      (agenciesData || []).forEach((a) => {
        const allSystems: PerSystemTotals[] = (systems || []).map((s) => ({
          system_id: s.id,
          system_name: s.name,
          sales_bs: 0,
          sales_usd: 0,
          prizes_bs: 0,
          prizes_usd: 0,
        }));

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
          per_system: allSystems,
          gastos_details: [],
          deudas_details: [],
          premios_por_pagar_details: [],
          weekly_config_saved: false,
        };
      });

      // Agregar datos reales a los sistemas que tienen movimientos (solo de encargadas)
      (encargadaDetails || []).forEach((d) => {
        const agencyId = d.agency_id;
        const ag = byAgency[agencyId];
        if (!ag) return;

        const systemIdx = ag.per_system.findIndex((s) => s.system_id === d.lottery_system_id);
        if (systemIdx !== -1) {
          ag.per_system[systemIdx].sales_bs += Number(d.sales_bs || 0);
          ag.per_system[systemIdx].sales_usd += Number(d.sales_usd || 0);
          ag.per_system[systemIdx].prizes_bs += Number(d.prizes_bs || 0);
          ag.per_system[systemIdx].prizes_usd += Number(d.prizes_usd || 0);
        }
      });

      // Calcular totales de ventas/premios y cuadre
      Object.values(byAgency).forEach((ag) => {
        ag.per_system.forEach((s) => {
          ag.total_sales_bs += s.sales_bs;
          ag.total_sales_usd += s.sales_usd;
          ag.total_prizes_bs += s.prizes_bs;
          ag.total_prizes_usd += s.prizes_usd;
        });
        // Calcular total del cuadre (Ventas - Premios)
        ag.total_cuadre_bs = ag.total_sales_bs - ag.total_prizes_bs;
        ag.total_cuadre_usd = ag.total_sales_usd - ag.total_prizes_usd;
      });

      // Fetch manual weekly totals and merge
      const { data: manualTotals, error: manualTotalsError } = await supabase
        .from("weekly_system_totals")
        .select("*")
        .eq("week_start_date", startStr)
        .eq("week_end_date", endStr);

      if (manualTotalsError) {
        console.warn("Error fetching manual totals:", manualTotalsError);
      }

      // Merge manual totals: override only the systems that have a manual adjustment.
      // Do NOT reset all totals to 0 first — that would discard the calculated values
      // for systems without a manual entry, causing partial/wrong totals.
      if (manualTotals && manualTotals.length > 0) {
        Object.values(byAgency).forEach((ag) => {
          const agencyManualTotals = manualTotals.filter((m: any) => m.agency_id === ag.agency_id);

          if (agencyManualTotals.length > 0) {
            // Apply manual overrides only to the specific systems that have them
            ag.per_system = ag.per_system.map((sys) => {
              const manual = agencyManualTotals.find((m: any) => m.lottery_system_id === sys.system_id);

              if (manual) {
                // Use manual values and mark as adjusted
                return {
                  ...sys,
                  sales_bs: Number(manual.sales_bs || 0),
                  sales_usd: Number(manual.sales_usd || 0),
                  prizes_bs: Number(manual.prizes_bs || 0),
                  prizes_usd: Number(manual.prizes_usd || 0),
                  is_adjusted: true,
                  adjusted_by: manual.adjusted_by,
                  adjusted_at: manual.adjusted_at,
                  notes: manual.notes,
                } as any;
              }
              return sys;
            });

            // Recalculate totals from the (now partially-overridden) per_system array
            ag.total_sales_bs = 0;
            ag.total_sales_usd = 0;
            ag.total_prizes_bs = 0;
            ag.total_prizes_usd = 0;
            ag.per_system.forEach((s) => {
              ag.total_sales_bs += s.sales_bs;
              ag.total_sales_usd += s.sales_usd;
              ag.total_prizes_bs += s.prizes_bs;
              ag.total_prizes_usd += s.prizes_usd;
            });

            ag.total_cuadre_bs = ag.total_sales_bs - ag.total_prizes_bs;
            ag.total_cuadre_usd = ag.total_sales_usd - ag.total_prizes_usd;
          }
        });
      }


      // Fallback: si una agencia no tiene datos en encargada_cuadre_details (de encargadas), usar daily_cuadres_summary
      // IMPORTANTE: Solo usar registros de encargadas (filtrar por encargadaUserIds)
      Object.values(byAgency).forEach((ag) => {
        if (ag.total_sales_bs === 0 && ag.total_sales_usd === 0) {
          const summariesForAgency = (summaryData || [])
            .filter((s) => s.agency_id === ag.agency_id && encargadaUserIds.has((s as any).user_id));
          summariesForAgency.forEach((s: any) => {
            ag.total_sales_bs += Number(s.total_sales_bs || 0);
            ag.total_sales_usd += Number(s.total_sales_usd || 0);
            ag.total_prizes_bs += Number(s.total_prizes_bs || 0);
            ag.total_prizes_usd += Number(s.total_prizes_usd || 0);
          });
          ag.total_cuadre_bs = ag.total_sales_bs - ag.total_prizes_bs;
          ag.total_cuadre_usd = ag.total_sales_usd - ag.total_prizes_usd;
        }
      });

      // Resumen encargada (banco, premios por pagar, tasa del domingo)
      // Filtrar summaryData solo por encargadas para no mezclar datos de taquilleras
      const encargadaSummaryData = (summaryData || []).filter(
        (s: any) => encargadaUserIds.has(s.user_id)
      );
      const latestByDateByAgency = new Map<string, Map<string, any>>();
      encargadaSummaryData.forEach((s: any) => {
        if (!latestByDateByAgency.has(s.agency_id)) latestByDateByAgency.set(s.agency_id, new Map());
        const byDate = latestByDateByAgency.get(s.agency_id)!;
        const existing = byDate.get(s.session_date as string);
        const existingTime = existing?.updated_at || existing?.created_at;
        const newTime = s.updated_at || s.created_at;
        if (!existing || (newTime && existingTime && new Date(newTime) > new Date(existingTime))) {
          byDate.set(s.session_date as string, s);
        }
      });

      Object.entries(byAgency).forEach(([agencyId, ag]) => {
        const byDate = latestByDateByAgency.get(agencyId);
        if (byDate) {
          const list = Array.from(byDate.values());
          ag.total_banco_bs = list.reduce((sum, v: any) => sum + Number(v.total_banco_bs || 0), 0);
          // NOTE: premios_por_pagar_bs/usd are now calculated from pending_prizes table
          // with is_paid filtering (see lines below), not from this legacy field
          const sunday = byDate.get(endStr!);
          ag.sunday_exchange_rate = sunday?.exchange_rate ? Number(sunday.exchange_rate) : ag.sunday_exchange_rate;
        }

        // Depósito semanal (guardado en weekly_cuadre_config)
        ag.deposit_bs = depositByAgency.get(agencyId) ?? 0;

        // Campos del cierre semanal de la encargada
        const cfg = weeklyConfigByAgency.get(agencyId);
        if (cfg) {
          ag.weekly_config_saved = true;
          ag.weekly_config_exchange_rate = Number(cfg.exchange_rate ?? 0);
          ag.weekly_config_cash_bs = Number(cfg.cash_available_bs ?? 0);
          ag.weekly_config_cash_usd = Number(cfg.cash_available_usd ?? 0);
          ag.weekly_config_closure_notes = cfg.closure_notes || "";
          ag.weekly_config_additional_bs = Number(cfg.additional_amount_bs ?? 0);
          ag.weekly_config_additional_usd = Number(cfg.additional_amount_usd ?? 0);
          ag.weekly_config_additional_notes = cfg.additional_notes || "";
          ag.weekly_config_apply_excess_usd = cfg.apply_excess_usd ?? true;
          ag.weekly_config_excess_usd = Number(cfg.excess_usd ?? 0);
          ag.weekly_config_final_difference = Number(cfg.final_difference ?? 0);
        }
      });

      // Gastos/Deudas con detalles
      (expenses || []).forEach((e) => {
        const agencyId = e.agency_id || (e.session_id ? sessionToAgency.get(e.session_id) : undefined);
        if (!agencyId || !byAgency[agencyId]) return;

        const expenseDetail: ExpenseDetail = {
          id: e.id,
          date: e.transaction_date as string,
          category: e.category,
          amount_bs: Number(e.amount_bs || 0),
          amount_usd: Number(e.amount_usd || 0),
          description: e.description || undefined,
          is_paid: e.is_paid || false,
        };

        if (e.category === "deuda") {
          // Add all debts to details but only count unpaid ones in totals
          byAgency[agencyId].deudas_details.push(expenseDetail);
          if (!e.is_paid) {
            byAgency[agencyId].total_deudas_bs += expenseDetail.amount_bs;
            byAgency[agencyId].total_deudas_usd += expenseDetail.amount_usd;
          }
        } else if (e.category === "gasto_operativo") {
          // Add all expenses to details but only count unpaid ones in totals
          byAgency[agencyId].gastos_details.push(expenseDetail);
          if (!e.is_paid) {
            byAgency[agencyId].total_gastos_bs += expenseDetail.amount_bs;
            byAgency[agencyId].total_gastos_usd += expenseDetail.amount_usd;
          }
        }
      });

      // Premios por pagar con detalles
      pendingPrizesData.forEach((p: any) => {
        const agencyId = p.session_id ? sessionToAgency.get(p.session_id) : undefined;
        if (!agencyId || !byAgency[agencyId]) return;

        const sessionDate = sessionToDate.get(p.session_id) || p.created_at?.split('T')[0];

        const prizeDetail: PendingPrizeDetail = {
          id: p.id,
          date: sessionDate,
          amount_bs: Number(p.amount_bs || 0),
          amount_usd: Number(p.amount_usd || 0),
          description: p.description || undefined,
          is_paid: p.is_paid || false,
        };

        byAgency[agencyId].premios_por_pagar_details.push(prizeDetail);

        // Solo contar los no pagados en los totales
        if (!p.is_paid) {
          byAgency[agencyId].premios_por_pagar_bs += prizeDetail.amount_bs;
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
    const weekEndStr = format(weekEnd, "yyyy-MM-dd");

    const upserts = systems.map((sys) => ({
      agency_id: agencyId,
      week_start_date: weekStartStr,
      week_end_date: weekEndStr,
      lottery_system_id: sys.system_id,
      sales_bs: sys.sales_bs,
      sales_usd: sys.sales_usd,
      prizes_bs: sys.prizes_bs,
      prizes_usd: sys.prizes_usd,
      adjusted_by: userId,
      adjusted_at: new Date().toISOString(),
      notes: notes || null,
    }));

    const { error } = await supabase.from("weekly_system_totals").upsert(upserts);

    if (error) {
      throw new Error(error.message);
    }

    // Refresh data after saving
    await fetchAll();
  };

  return {
    loading,
    error,
    agencies,
    summaries,
    refresh: fetchAll,
    saveSystemTotals,
  };
}
