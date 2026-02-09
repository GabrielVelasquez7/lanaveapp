import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDateForDB } from "@/lib/dateUtils";
import { startOfWeek, format } from "date-fns";
import { useCuadrePersistence } from "./useCuadrePersistence";

export interface CuadreData {
    totalSales: { bs: number; usd: number };
    totalPrizes: { bs: number; usd: number };
    totalGastos: { bs: number; usd: number };
    totalDeudas: { bs: number; usd: number };
    gastosDetails: any[];
    deudasDetails: any[];
    pagoMovilRecibidos: number;
    pagoMovilPagados: number;
    totalPointOfSale: number;
    pendingPrizes: number;
    cashAvailable: number;
    cashAvailableUsd: number;
    closureConfirmed: boolean;
    closureNotes: string;
    exchangeRate: number;
    applyExcessUsd: boolean;
    additionalAmountBs: number;
    additionalAmountUsd: number;
    additionalNotes: string;
}

export const useCuadreGeneral = (
    selectedAgency: string,
    selectedDate: Date,
    refreshKey: number = 0
) => {
    const { user } = useAuth();
    const { toast } = useToast();

    const [cuadre, setCuadre] = useState<CuadreData>({
        totalSales: { bs: 0, usd: 0 },
        totalPrizes: { bs: 0, usd: 0 },
        totalGastos: { bs: 0, usd: 0 },
        totalDeudas: { bs: 0, usd: 0 },
        gastosDetails: [],
        deudasDetails: [],
        pagoMovilRecibidos: 0,
        pagoMovilPagados: 0,
        totalPointOfSale: 0,
        pendingPrizes: 0,
        cashAvailable: 0,
        cashAvailableUsd: 0,
        closureConfirmed: false,
        closureNotes: "",
        exchangeRate: 36.0,
        applyExcessUsd: true,
        additionalAmountBs: 0,
        additionalAmountUsd: 0,
        additionalNotes: ""
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [approving, setApproving] = useState(false);

    // Review status
    const [reviewStatus, setReviewStatus] = useState<string | null>(null);
    const [reviewedBy, setReviewedBy] = useState<string | null>(null);
    const [reviewedAt, setReviewedAt] = useState<string | null>(null);
    const [reviewObservations, setReviewObservations] = useState<string | null>(null);
    const [agencyName, setAgencyName] = useState<string>("");

    // Hook for persistence
    const {
        persistedState,
        hasLoadedFromStorage,
        saveToStorage,
        clearStorage
    } = useCuadrePersistence(selectedAgency, selectedDate, !loading);

    const fetchCuadreData = useCallback(async () => {
        if (!user || !selectedAgency || !selectedDate) return;

        setLoading(true);
        const dateStr = formatDateForDB(selectedDate);

        try {
            // 1. Fetch Transactions (Sales, Prizes)
            // PRIORITY 1: encargada_cuadre_details
            const { data: detailsData } = await supabase
                .from("encargada_cuadre_details")
                .select("sales_bs, sales_usd, prizes_bs, prizes_usd")
                .eq("agency_id", selectedAgency)
                .eq("session_date", dateStr)
                .eq("user_id", user.id);

            let totalSales = { bs: 0, usd: 0 };
            let totalPrizes = { bs: 0, usd: 0 };

            if (detailsData && detailsData.length > 0) {
                totalSales = {
                    bs: detailsData.reduce((sum, d) => sum + Number(d.sales_bs || 0), 0),
                    usd: detailsData.reduce((sum, d) => sum + Number(d.sales_usd || 0), 0)
                };
                totalPrizes = {
                    bs: detailsData.reduce((sum, d) => sum + Number(d.prizes_bs || 0), 0),
                    usd: detailsData.reduce((sum, d) => sum + Number(d.prizes_usd || 0), 0)
                };
            } else {
                // PRIORITY 2: Consolidate Taquilleras
                const { data: taquilleras } = await supabase.from("profiles")
                    .select("user_id")
                    .eq("agency_id", selectedAgency)
                    .eq("role", "taquillero")
                    .eq("is_active", true);

                if (taquilleras && taquilleras.length > 0) {
                    const taquilleraIds = taquilleras.map(t => t.user_id);
                    const { data: sessions } = await supabase.from("daily_sessions")
                        .select("id")
                        .eq("session_date", dateStr)
                        .in("user_id", taquilleraIds);

                    if (sessions && sessions.length > 0) {
                        const sessionIds = sessions.map(s => s.id);
                        const [salesResult, prizesResult] = await Promise.all([
                            supabase.from("sales_transactions").select("amount_bs, amount_usd").in("session_id", sessionIds),
                            supabase.from("prize_transactions").select("amount_bs, amount_usd").in("session_id", sessionIds)
                        ]);

                        if (salesResult.data) {
                            totalSales = {
                                bs: salesResult.data.reduce((sum, s) => sum + Number(s.amount_bs || 0), 0),
                                usd: salesResult.data.reduce((sum, s) => sum + Number(s.amount_usd || 0), 0)
                            };
                        }
                        if (prizesResult.data) {
                            totalPrizes = {
                                bs: prizesResult.data.reduce((sum, p) => sum + Number(p.amount_bs || 0), 0),
                                usd: prizesResult.data.reduce((sum, p) => sum + Number(p.amount_usd || 0), 0)
                            };
                        }
                    }
                }
            }

            // 2. Fetch Sessions for Expenses/Mobile/POS
            let taquilleraSessionIds: string[] = [];
            const { data: taquilleras } = await supabase.from("profiles")
                .select("user_id")
                .eq("agency_id", selectedAgency)
                .eq("role", "taquillero")
                .eq("is_active", true);

            if (taquilleras && taquilleras.length > 0) {
                const taquilleraIds = taquilleras.map(t => t.user_id);
                const { data: sessions } = await supabase.from("daily_sessions")
                    .select("id")
                    .eq("session_date", dateStr)
                    .in("user_id", taquilleraIds);
                if (sessions) {
                    taquilleraSessionIds = sessions.map(s => s.id);
                }
            }

            // 3. Fetch Complementary Data
            const expensesQueries = [supabase.from("expenses").select("*").eq("agency_id", selectedAgency).eq("transaction_date", dateStr)];
            const mobileQueries = [supabase.from("mobile_payments").select("*").eq("agency_id", selectedAgency).eq("transaction_date", dateStr)];
            const posQueries = [supabase.from("point_of_sale").select("*").eq("agency_id", selectedAgency).eq("transaction_date", dateStr)];

            if (taquilleraSessionIds.length > 0) {
                expensesQueries.push(supabase.from("expenses").select("*").in("session_id", taquilleraSessionIds));
                mobileQueries.push(supabase.from("mobile_payments").select("*").in("session_id", taquilleraSessionIds));
                posQueries.push(supabase.from("point_of_sale").select("*").in("session_id", taquilleraSessionIds));
            }

            const [expensesResults, mobileResults, posResults, summaryResult, agencyResult] = await Promise.all([
                Promise.all(expensesQueries),
                Promise.all(mobileQueries),
                Promise.all(posQueries),
                supabase.from("daily_cuadres_summary")
                    .select("*")
                    .eq("agency_id", selectedAgency)
                    .eq("session_date", dateStr)
                    .is("session_id", null)
                    .maybeSingle(),
                supabase.from("agencies").select("name").eq("id", selectedAgency).single()
            ]);

            // Consolidate Data
            const allExpenses: any[] = [];
            expensesResults.forEach(r => { if (r.data) allExpenses.push(...r.data) });
            const uniqueExpenses = Array.from(new Map(allExpenses.map(item => [item.id, item])).values());
            const expensesList = uniqueExpenses;
            const gastosList = expensesList.filter(e => e.category === "gasto_operativo");
            const deudasList = expensesList.filter(e => e.category === "deuda");

            const allMobile: any[] = [];
            mobileResults.forEach(r => { if (r.data) allMobile.push(...r.data) });
            const uniqueMobile = Array.from(new Map(allMobile.map(item => [item.id, item])).values());

            const allPos: any[] = [];
            posResults.forEach(r => { if (r.data) allPos.push(...r.data) });
            const uniquePos = Array.from(new Map(allPos.map(item => [item.id, item])).values());

            // Calculate Totals
            const totalGastos = {
                bs: gastosList.reduce((sum, g) => sum + Number(g.amount_bs || 0), 0),
                usd: gastosList.reduce((sum, g) => sum + Number(g.amount_usd || 0), 0)
            };
            const totalDeudas = {
                bs: deudasList.reduce((sum, d) => sum + Number(d.amount_bs || 0), 0),
                usd: deudasList.reduce((sum, d) => sum + Number(d.amount_usd || 0), 0)
            };
            const pagoMovilRecibidos = uniqueMobile.filter(m => Number(m.amount_bs) > 0).reduce((sum, m) => sum + Number(m.amount_bs), 0);
            const pagoMovilPagados = Math.abs(uniqueMobile.filter(m => Number(m.amount_bs) < 0).reduce((sum, m) => sum + Number(m.amount_bs), 0));
            const totalPointOfSale = uniquePos.reduce((sum, p) => sum + Number(p.amount_bs || 0), 0);

            // Summary Data (Editable Fields)
            const summaryData = summaryResult.data;
            let notesData: any = {};
            try {
                if (summaryData?.notes) notesData = JSON.parse(summaryData.notes);
            } catch (e) { }

            // NOTE: If summaryData exists, use it. If not, and we have persistence, use that (handled by component via exposed props).
            // Here we set the "Backend" state.

            // Agency Name
            if (agencyResult.data) setAgencyName(agencyResult.data.name);

            // Review Status
            setReviewStatus(summaryData?.encargada_status || "pendiente");
            setReviewObservations(summaryData?.encargada_observations);
            setReviewedBy(summaryData?.encargada_reviewed_by);
            setReviewedAt(summaryData?.encargada_reviewed_at);

            setCuadre({
                totalSales,
                totalPrizes,
                totalGastos,
                totalDeudas,
                gastosDetails: gastosList,
                deudasDetails: deudasList,
                pagoMovilRecibidos,
                pagoMovilPagados,
                totalPointOfSale,
                pendingPrizes: Number(summaryData?.pending_prizes || 0),
                cashAvailable: Number(summaryData?.cash_available_bs || 0),
                cashAvailableUsd: Number(summaryData?.cash_available_usd || 0),
                closureConfirmed: summaryData?.daily_closure_confirmed || false,
                closureNotes: summaryData?.closure_notes || "",
                exchangeRate: Number(summaryData?.exchange_rate || 36.0),
                applyExcessUsd: notesData.applyExcessUsd !== undefined ? notesData.applyExcessUsd : true,
                additionalAmountBs: Number(notesData.additionalAmountBs || 0),
                additionalAmountUsd: Number(notesData.additionalAmountUsd || 0),
                additionalNotes: notesData.additionalNotes || ""
            });

        } catch (error: any) {
            console.error("Error fetching cuadre data:", error);
            toast({
                title: "Error",
                description: "Error al cargar datos del cuadre",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }, [user, selectedAgency, selectedDate, refreshKey, toast]);

    useEffect(() => {
        fetchCuadreData();
    }, [fetchCuadreData]);


    // Helper to calculate verification logic
    const calculateTotals = (inputs: any) => {
        // Inputs come from the UI (could be persisted or user edited)
        const {
            exchangeRateInput,
            cashAvailableInput,
            cashAvailableUsdInput,
            pendingPrizesInput,
            pendingPrizesUsdInput,
            additionalAmountBsInput,
            additionalAmountUsdInput,
            applyExcessUsdSwitch
        } = inputs;

        const rate = parseFloat(exchangeRateInput) || 36.0;
        const cashBs = parseFloat(cashAvailableInput) || 0;
        const cashUsd = parseFloat(cashAvailableUsdInput) || 0;
        const pendingBs = parseFloat(pendingPrizesInput) || 0;
        const pendingUsd = parseFloat(pendingPrizesUsdInput) || 0;
        const addBs = parseFloat(additionalAmountBsInput) || 0;
        const addUsd = parseFloat(additionalAmountUsdInput) || 0;

        const cuadreVentasPremios = {
            bs: cuadre.totalSales.bs - cuadre.totalPrizes.bs,
            usd: cuadre.totalSales.usd - cuadre.totalPrizes.usd
        };

        const totalBanco = cuadre.pagoMovilRecibidos + cuadre.totalPointOfSale - cuadre.pagoMovilPagados;

        // USD Calculation
        const sumatoriaUsd = cashUsd + cuadre.totalDeudas.usd + cuadre.totalGastos.usd;
        const diferenciaFinalUsd = sumatoriaUsd - cuadreVentasPremios.usd - addUsd - pendingUsd;
        const excessUsd = diferenciaFinalUsd; // The logic in component used this as excess

        // BS Calculation
        // Apply excess USD if switch is on
        const excessUsdInBs = applyExcessUsdSwitch ? (excessUsd * rate) : 0;

        // Formula: (Efectivo + Banco + Deudas + Gastos + ExcedenteUSD) - Adicionales
        const sumatoriaBolivares = cashBs + totalBanco + cuadre.totalDeudas.bs + cuadre.totalGastos.bs + excessUsdInBs - addBs;

        // Diferencia Cierre = Sumatoria - (Ventas - Premios)
        const diferenciaCierre = sumatoriaBolivares - cuadreVentasPremios.bs;

        // Diferencia Final = Diferencia Cierre - Premios Por Pagar
        const diferenciaFinal = diferenciaCierre - pendingBs;

        return {
            cuadreVentasPremios,
            totalBanco,
            sumatoriaBolivares,
            sumatoriaUsd,
            diferenciaFinal,
            diferenciaFinalUsd,
            excessUsd,
            isBalanced: Math.abs(diferenciaFinal) <= 100 // Tolerance
        };
    };

    const handleSave = async (inputs: any, approve: boolean = false) => {
        if (!user || !selectedAgency || !selectedDate) return;

        setSaving(true);
        if (approve) setApproving(true);

        try {
            const dateStr = formatDateForDB(selectedDate);
            const {
                exchangeRateInput,
                cashAvailableInput,
                cashAvailableUsdInput,
                pendingPrizesInput,
                pendingPrizesUsdInput,
                closureNotesInput,
                additionalAmountBsInput,
                additionalAmountUsdInput,
                additionalNotesInput,
                applyExcessUsdSwitch
            } = inputs;

            // Perform calculations to save derived data
            const totals = calculateTotals(inputs);
            const notesData = {
                additionalAmountBs: parseFloat(additionalAmountBsInput) || 0,
                additionalAmountUsd: parseFloat(additionalAmountUsdInput) || 0,
                additionalNotes: additionalNotesInput,
                applyExcessUsd: applyExcessUsdSwitch
            };

            const summaryData = {
                user_id: user.id,
                agency_id: selectedAgency,
                session_date: dateStr,
                session_id: null, // Encargada level
                total_sales_bs: cuadre.totalSales.bs,
                total_sales_usd: cuadre.totalSales.usd,
                total_prizes_bs: cuadre.totalPrizes.bs,
                total_prizes_usd: cuadre.totalPrizes.usd,
                total_expenses_bs: cuadre.totalGastos.bs + cuadre.totalDeudas.bs,
                total_expenses_usd: cuadre.totalGastos.usd + cuadre.totalDeudas.usd,
                total_debt_bs: cuadre.totalDeudas.bs,
                total_debt_usd: cuadre.totalDeudas.usd,
                total_mobile_payments_bs: cuadre.pagoMovilRecibidos - cuadre.pagoMovilPagados,
                total_pos_bs: cuadre.totalPointOfSale,
                total_banco_bs: totals.totalBanco,
                pending_prizes: parseFloat(pendingPrizesInput) || 0,
                pending_prizes_usd: parseFloat(pendingPrizesUsdInput) || 0,
                balance_before_pending_prizes_bs: totals.sumatoriaBolivares - totals.cuadreVentasPremios.bs, // Diferencia Cierre
                diferencia_final: totals.diferenciaFinal,
                balance_bs: totals.diferenciaFinal,
                excess_usd: totals.excessUsd,
                exchange_rate: parseFloat(exchangeRateInput) || 36,
                cash_available_bs: parseFloat(cashAvailableInput) || 0,
                cash_available_usd: parseFloat(cashAvailableUsdInput) || 0,
                closure_notes: closureNotesInput,
                notes: JSON.stringify(notesData),
                daily_closure_confirmed: true,
                is_closed: true, // Mark as closed

                // Only set approval fields if approve is true

                ...(approve ? {
                    encargada_status: "aprobado",
                    encargada_reviewed_by: user.id,
                    encargada_reviewed_at: new Date().toISOString(),
                    encargada_observations: null
                } : {
                    // If just saving, keep existing status or set to specific 'draft' state if needed
                    // For now, we don't change status unless approving
                })
            };

            // Upsert summary
            const { data: existingSummary } = await supabase.from("daily_cuadres_summary")
                .select("id")
                .eq("agency_id", selectedAgency)
                .eq("session_date", dateStr)
                .is("session_id", null)
                .maybeSingle();

            if (existingSummary?.id) {
                const { error: updateError } = await supabase.from("daily_cuadres_summary").update(summaryData).eq("id", existingSummary.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase.from("daily_cuadres_summary").insert(summaryData);
                if (insertError) throw insertError;
            }

            // Handle Taquillera Approvals ONLY if Approving
            let sessionIdsApproved = 0;
            if (approve) {
                const { data: taquilleras } = await supabase.from("profiles")
                    .select("user_id")
                    .eq("agency_id", selectedAgency)
                    .eq("role", "taquillero")
                    .eq("is_active", true);

                const taquilleraIds = taquilleras?.map(t => t.user_id) || [];
                if (taquilleraIds.length > 0) {
                    const { data: sessions } = await supabase.from("daily_sessions")
                        .select("id")
                        .eq("session_date", dateStr)
                        .in("user_id", taquilleraIds);

                    const sessionIds = sessions?.map(s => s.id) || [];
                    if (sessionIds.length > 0) {
                        sessionIdsApproved = sessionIds.length;
                        const { error: approvalError } = await supabase.from("daily_cuadres_summary")
                            .update({
                                encargada_status: "aprobado",
                                encargada_reviewed_by: user.id,
                                encargada_reviewed_at: new Date().toISOString()
                            })
                            .eq("session_date", dateStr)
                            .eq("agency_id", selectedAgency)
                            .in("session_id", sessionIds);

                        if (approvalError) throw approvalError;
                    }
                }
            }

            // Clear persistence
            clearStorage();

            // Notify
            toast({
                title: approve ? "¡Día Aprobado!" : "Progreso Guardado",
                description: approve
                    ? `Se ha cerrado y aprobado el día correctamente. (${sessionIdsApproved} taquilleras aprobadas)`
                    : "Se han guardado los datos del cierre. No olvides aprobar al finalizar.",
                // variant: approve ? "default" : "secondary" // removed variant as secondary is not valid for toast
            });

            // Trigger Refresh for Bank Balance
            const sessionDate = new Date(dateStr + 'T00:00:00');
            const weekStart = startOfWeek(sessionDate, { weekStartsOn: 1 });
            window.dispatchEvent(new CustomEvent('cuadre-saved', {
                detail: {
                    agency_id: selectedAgency,
                    session_date: dateStr,
                    week_start_date: format(weekStart, 'yyyy-MM-dd')
                }
            }));

            // Refetch everything
            await fetchCuadreData();

        } catch (error: any) {
            console.error("Error saving/approving:", error);
            toast({ title: "Error", description: error.message || "Error al procesar", variant: "destructive" });
        } finally {
            setSaving(false);
            setApproving(false);
        }
    };

    return {
        loading,
        saving,
        approving,
        cuadre,
        agencyName,
        reviewStatus,
        reviewObservations,
        reviewedBy,
        reviewedAt,
        // Persistence
        persistedState,
        hasLoadedFromStorage,
        saveToStorage,
        // Actions
        calculateTotals,
        handleSave,
        fetchCuadreData
    };
};
