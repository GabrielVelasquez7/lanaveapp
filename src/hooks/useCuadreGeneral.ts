import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDateForDB } from "@/lib/dateUtils";
import { startOfWeek, format } from "date-fns";
import { useCuadrePersistence } from "./useCuadrePersistence";
import { transactionService } from "@/services/transactionService";
import { calculateCuadreTotals } from '@/lib/financialMath';
import { handleError } from '@/lib/errors';

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
    // Computed totals from financialMath
    totals?: any;
}

export const useCuadreGeneral = (
    selectedAgency: string,
    selectedDate: Date
) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // We keep these for UI state that isn't derived from the DB until saved
    // Actually, we should probably stick to the pattern used in useTaquilleraCuadre:
    // Separate FormState from DataState.
    // But useCuadreGeneral mixes them heavily.
    // Let's try to verify if we can separate them or if valid to keep usage of setCuadre directly?
    // The previous implementation used `setCuadre` for both data and form inputs.
    // I will separate Form State for cleaner React Query integration.

    const [formState, setFormState] = useState({
        exchangeRate: '36.00',
        cashAvailable: '0',
        cashAvailableUsd: '0',
        closureNotes: '',
        applyExcessUsd: true,
        additionalAmountBs: '0',
        additionalAmountUsd: '0',
        additionalNotes: '',
        pendingPrizes: '0',
        pendingPrizesUsd: '0'
    });

    const [reviewStatus, setReviewStatus] = useState<string | null>(null);
    const [reviewedBy, setReviewedBy] = useState<string | null>(null);
    const [reviewedAt, setReviewedAt] = useState<string | null>(null);
    const [reviewObservations, setReviewObservations] = useState<string | null>(null);
    const [agencyName, setAgencyName] = useState<string>("");


    // 1. Fetch Data
    const { data: fetchedData, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['cuadre-general', selectedAgency, formatDateForDB(selectedDate)],
        queryFn: async () => {
            if (!user || !selectedAgency || !selectedDate) return null;
            const dateStr = formatDateForDB(selectedDate);

            // Priority 1: encargada_cuadre_details
            // Note: Assuming transactionService.getEncargadaDetails exists and works as expected
            const detailsData = await transactionService.getEncargadaDetails(selectedAgency, dateStr, user.id);

            let totalSales = { bs: 0, usd: 0 };
            let totalPrizes = { bs: 0, usd: 0 };
            let taquilleraSessionIds: string[] = [];

            let sessionObjects: any[] = [];

            if (detailsData && detailsData.length > 0) {
                totalSales = {
                    bs: detailsData.reduce((sum: any, d: any) => sum + Number(d.sales_bs || 0), 0),
                    usd: detailsData.reduce((sum: any, d: any) => sum + Number(d.sales_usd || 0), 0)
                };
                totalPrizes = {
                    bs: detailsData.reduce((sum: any, d: any) => sum + Number(d.prizes_bs || 0), 0),
                    usd: detailsData.reduce((sum: any, d: any) => sum + Number(d.prizes_usd || 0), 0)
                };

                const { data: taquilleras } = await supabase.from("profiles")
                    .select("user_id")
                    .eq("agency_id", selectedAgency)
                    .eq("role", "taquillero")
                    .eq("is_active", true);

                if (taquilleras?.length) {
                    const tIds = taquilleras.map(t => t.user_id);
                    const { data: sessions } = await supabase.from("daily_sessions")
                        .select("id, cash_available_bs, cash_available_usd, exchange_rate, closure_notes, notes")
                        .eq("session_date", dateStr)
                        .in("user_id", tIds);
                    if (sessions && sessions.length > 0) {
                        sessionObjects = sessions;
                        taquilleraSessionIds = sessions.map(s => s.id);
                    }
                }
            } else {
                const { data: taquilleras } = await supabase.from("profiles")
                    .select("user_id")
                    .eq("agency_id", selectedAgency)
                    .eq("role", "taquillero")
                    .eq("is_active", true);

                if (taquilleras && taquilleras.length > 0) {
                    const tIds = taquilleras.map(t => t.user_id);
                    const { data: sessions } = await supabase.from("daily_sessions")
                        .select("id, cash_available_bs, cash_available_usd, exchange_rate, closure_notes, notes")
                        .eq("session_date", dateStr)
                        .in("user_id", tIds);

                    if (sessions && sessions.length > 0) {
                        sessionObjects = sessions;
                        taquilleraSessionIds = sessions.map(s => s.id);

                        const [sales, prizes] = await Promise.all([
                            transactionService.getSales(taquilleraSessionIds),
                            transactionService.getPrizes(taquilleraSessionIds)
                        ]);

                        totalSales = {
                            bs: sales.reduce((sum: any, s: any) => sum + Number(s.amount_bs || 0), 0),
                            usd: sales.reduce((sum: any, s: any) => sum + Number(s.amount_usd || 0), 0)
                        };
                        totalPrizes = {
                            bs: prizes.reduce((sum: any, s: any) => sum + Number(s.amount_bs || 0), 0),
                            usd: prizes.reduce((sum: any, s: any) => sum + Number(s.amount_usd || 0), 0)
                        };
                    }
                }
            }

            // Fetch Complementary Data
            const [expensesList, uniqueMobile, uniquePos, summaryData, agencyResult, pendingPrizesList] = await Promise.all([
                transactionService.getExpensesCombined(taquilleraSessionIds, selectedAgency, dateStr),
                transactionService.getMobilePaymentsCombined(taquilleraSessionIds, selectedAgency, dateStr),
                transactionService.getPointOfSaleCombined(taquilleraSessionIds, selectedAgency, dateStr),
                supabase.from("daily_cuadres_summary").select("*").eq("agency_id", selectedAgency).eq("session_date", dateStr).is("session_id", null).maybeSingle().then(r => r.data),
                supabase.from("agencies").select("name").eq("id", selectedAgency).single(),
                transactionService.getPendingPrizes(taquilleraSessionIds)
            ]);

            // Aggregation of Taquillera Session Data
            const aggregated = {
                cashBs: 0,
                cashUsd: 0,
                exchangeRate: 0,
                closureNotes: '',
                addBs: 0,
                addUsd: 0,
                addNotes: '',
                pendingPrizesBs: 0,
                pendingPrizesUsd: 0
            };

            if (sessionObjects.length > 0) {
                console.log('[useCuadreGeneral] Found sessions for aggregation:', sessionObjects.length, sessionObjects);
                aggregated.cashBs = sessionObjects.reduce((sum, s) => sum + Number(s.cash_available_bs || 0), 0);
                aggregated.cashUsd = sessionObjects.reduce((sum, s) => sum + Number(s.cash_available_usd || 0), 0);
                aggregated.exchangeRate = sessionObjects.reduce((max, s) => Math.max(max, Number(s.exchange_rate || 0)), 0);

                aggregated.closureNotes = sessionObjects
                    .map(s => s.closure_notes)
                    .filter(Boolean)
                    .join("\n\n-- Taquillera --\n");

                // Fetch taquillera cuadre summaries to get additional amounts (stored in daily_cuadres_summary.notes)
                if (taquilleraSessionIds.length > 0) {
                    const { data: taqSummaries } = await supabase
                        .from("daily_cuadres_summary")
                        .select("notes")
                        .in("session_id", taquilleraSessionIds);

                    if (taqSummaries) {
                        taqSummaries.forEach(summary => {
                            if (summary.notes) {
                                try {
                                    const noteJson = JSON.parse(summary.notes as string);
                                    aggregated.addBs += Number(noteJson.additionalAmountBs || 0);
                                    aggregated.addUsd += Number(noteJson.additionalAmountUsd || 0);
                                    if (noteJson.additionalNotes) {
                                        aggregated.addNotes += (aggregated.addNotes ? "\n" : "") + noteJson.additionalNotes;
                                    }
                                } catch (e) {
                                    console.error("Error parsing cuadre summary notes", e);
                                }
                            }
                        });
                    }
                }
                console.log('[useCuadreGeneral] Calculated Aggregated:', aggregated);
            } else {
                console.log('[useCuadreGeneral] No sessionObjects found for aggregation');
            }

            if (pendingPrizesList && pendingPrizesList.length > 0) {
                aggregated.pendingPrizesBs = pendingPrizesList.filter((p: any) => !p.is_paid).reduce((sum: number, p: any) => sum + Number(p.amount_bs || 0), 0);
                aggregated.pendingPrizesUsd = pendingPrizesList.filter((p: any) => !p.is_paid).reduce((sum: number, p: any) => sum + Number(p.amount_usd || 0), 0);
            }

            return {
                totalSales,
                totalPrizes,
                expensesList,
                uniqueMobile,
                uniquePos,
                summaryData,
                agencyName: agencyResult.data?.name || "",
                aggregated
            };
        },
        enabled: !!user && !!selectedAgency && !!selectedDate,
        refetchOnMount: 'always',
        staleTime: 0,
    });

    // 2. Derived State
    const cuadre = useMemo<CuadreData>(() => {
        if (!fetchedData) {
            return {
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
                additionalNotes: "",
                totals: {} // Empty or default totals
            };
        }

        const { totalSales, totalPrizes, expensesList, uniqueMobile, uniquePos, summaryData } = fetchedData;

        const gastosList = expensesList.filter((e: any) => e.category === "gasto_operativo");
        const deudasList = expensesList.filter((e: any) => e.category === "deuda");

        const totalGastos = {
            bs: gastosList.reduce((sum: any, g: any) => sum + Number(g.amount_bs || 0), 0),
            usd: gastosList.reduce((sum: any, g: any) => sum + Number(g.amount_usd || 0), 0)
        };
        const totalDeudas = {
            bs: deudasList.reduce((sum: any, d: any) => sum + Number(d.amount_bs || 0), 0),
            usd: deudasList.reduce((sum: any, d: any) => sum + Number(d.amount_usd || 0), 0)
        };

        const pagoMovilRecibidos = uniqueMobile.filter((m: any) => Number(m.amount_bs) > 0).reduce((sum: any, m: any) => sum + Number(m.amount_bs), 0);
        const pagoMovilPagados = Math.abs(uniqueMobile.filter((m: any) => Number(m.amount_bs) < 0).reduce((sum: any, m: any) => sum + Number(m.amount_bs), 0));
        const totalPointOfSale = uniquePos.reduce((sum: any, p: any) => sum + Number(p.amount_bs || 0), 0);

        let notesData: any = {};
        try {
            if (summaryData?.notes) notesData = JSON.parse(summaryData.notes);
        } catch (e) { }

        // We use state values for "Current inputs" but we also need to surface the "Saved" values in the CuadreData?
        // Actually, let's just surface the calculated totals based on CURRENT Form State + Fetched Data.

        const totals = calculateCuadreTotals({
            totalSales, totalPrizes, totalGastos, totalDeudas,
            pagoMovilRecibidos, pagoMovilPagados, totalPointOfSale,
            cashAvailable: parseFloat(formState.cashAvailable) || 0,
            cashAvailableUsd: parseFloat(formState.cashAvailableUsd) || 0,
            pendingPrizes: parseFloat(formState.pendingPrizes) || 0,
            pendingPrizesUsd: parseFloat(formState.pendingPrizesUsd) || 0,
            additionalAmountBs: parseFloat(formState.additionalAmountBs) || 0,
            additionalAmountUsd: parseFloat(formState.additionalAmountUsd) || 0,
            exchangeRate: parseFloat(formState.exchangeRate) || 36.0,
            applyExcessUsd: formState.applyExcessUsd
        });

        return {
            totalSales, totalPrizes, totalGastos, totalDeudas,
            gastosDetails: gastosList, deudasDetails: deudasList,
            pagoMovilRecibidos, pagoMovilPagados, totalPointOfSale,
            pendingPrizes: Number(summaryData?.pending_prizes || 0), // From DB
            cashAvailable: Number(summaryData?.cash_available_bs || 0), // From DB
            cashAvailableUsd: Number(summaryData?.cash_available_usd || 0), // From DB
            closureConfirmed: summaryData?.daily_closure_confirmed || false,
            closureNotes: summaryData?.closure_notes || "",
            exchangeRate: Number(summaryData?.exchange_rate || 36.0),
            applyExcessUsd: notesData.applyExcessUsd !== undefined ? notesData.applyExcessUsd : true,
            additionalAmountBs: Number(notesData.additionalAmountBs || 0),
            additionalAmountUsd: Number(notesData.additionalAmountUsd || 0),
            additionalNotes: notesData.additionalNotes || "",
            totals
        };
    }, [fetchedData, formState]);


    // 3. Sync Server Data to Form State (Once)
    useEffect(() => {
        if (!fetchedData) return;
        const { summaryData, aggregated } = fetchedData;

        // Metadata assignment
        if (summaryData) {
            setReviewStatus(summaryData.encargada_status || "pendiente");
            setReviewObservations(summaryData.encargada_observations);
            setReviewedBy(summaryData.encargada_reviewed_by);
            setReviewedAt(summaryData.encargada_reviewed_at);
        }
        if (fetchedData.agencyName) setAgencyName(fetchedData.agencyName);

        // FORM STATE INITIALIZATION LOGIC
        // Always start with aggregated taquillera data as base, then overlay saved summary values
        const base = {
            exchangeRate: aggregated.exchangeRate > 0 ? aggregated.exchangeRate.toString() : '36.00',
            cashAvailable: aggregated.cashBs > 0 ? aggregated.cashBs.toString() : '0',
            cashAvailableUsd: aggregated.cashUsd > 0 ? aggregated.cashUsd.toString() : '0',
            closureNotes: aggregated.closureNotes || '',
            additionalAmountBs: aggregated.addBs > 0 ? aggregated.addBs.toString() : '0',
            additionalAmountUsd: aggregated.addUsd > 0 ? aggregated.addUsd.toString() : '0',
            additionalNotes: aggregated.addNotes || '',
            pendingPrizes: aggregated.pendingPrizesBs > 0 ? aggregated.pendingPrizesBs.toString() : '0',
            pendingPrizesUsd: aggregated.pendingPrizesUsd > 0 ? aggregated.pendingPrizesUsd.toString() : '0',
            applyExcessUsd: true,
        };

        if (summaryData) {
            // Case A: Encargada has existing save — overlay non-default saved values
            let notesData: any = {};
            try {
                if (summaryData.notes) notesData = JSON.parse(summaryData.notes);
            } catch (e) { }

            // Only override base with summary values if they are explicitly set (non-default)
            const summaryExchangeRate = Number(summaryData.exchange_rate || 0);
            const summaryCashBs = Number(summaryData.cash_available_bs || 0);
            const summaryCashUsd = Number(summaryData.cash_available_usd || 0);
            const summaryPending = Number(summaryData.pending_prizes || 0);
            const summaryPendingUsd = Number(summaryData.pending_prizes_usd || 0);

            setFormState(prev => ({
                ...prev,
                // Use summary value if encargada explicitly set it (non-default), otherwise use taquillera aggregate
                exchangeRate: summaryExchangeRate > 36 || summaryData.closure_notes ? summaryExchangeRate.toString() : base.exchangeRate,
                cashAvailable: summaryCashBs > 0 ? summaryCashBs.toString() : base.cashAvailable,
                cashAvailableUsd: summaryCashUsd > 0 ? summaryCashUsd.toString() : base.cashAvailableUsd,
                closureNotes: summaryData.closure_notes || base.closureNotes,
                applyExcessUsd: notesData.applyExcessUsd ?? base.applyExcessUsd,
                additionalAmountBs: Number(notesData.additionalAmountBs || 0) > 0 ? notesData.additionalAmountBs.toString() : base.additionalAmountBs,
                additionalAmountUsd: Number(notesData.additionalAmountUsd || 0) > 0 ? notesData.additionalAmountUsd.toString() : base.additionalAmountUsd,
                additionalNotes: notesData.additionalNotes || base.additionalNotes,
                pendingPrizes: summaryPending > 0 ? summaryPending.toString() : base.pendingPrizes,
                pendingPrizesUsd: summaryPendingUsd > 0 ? summaryPendingUsd.toString() : base.pendingPrizesUsd,
            }));
        } else {
            // Case B: No Encargada Summary exists yet — use taquillera aggregated data directly
            setFormState(prev => ({
                ...prev,
                ...base
            }));
        }

    }, [fetchedData]);

    // 4. Persistence (Keep existing hook pattern roughly)
    // We can use the existing hook logic but we need to pass it formState.
    // However, the existing hook handled `setCuadre`. now we have `setFormState`.
    // I'll manually implement persistence here for simplicity and to match useTaquilleraCuadre.
    const {
        persistedState,
        hasLoadedFromStorage,
        saveToStorage,
        clearStorage
    } = useCuadrePersistence(selectedAgency, selectedDate, !isLoading);

    // Load from storage
    useEffect(() => {
        // Ensure fetchedData matches current selectedDate/Agency before merging? 
        // fetchedData is dependency.
        if (hasLoadedFromStorage && persistedState && fetchedData && !fetchedData.summaryData?.daily_closure_confirmed) {
            // Smart Merge: If persisted value is default/zero but aggregated data exists, use aggregated data.
            const agg = fetchedData.aggregated;

            const resolveValue = (key: string, persisted: any, aggregated: number | undefined, defaultVal: string = '0') => {
                const pStr = persisted?.toString();
                // Special case for Exchange Rate default
                if (key === 'exchangeRate' && pStr === '36.00' && aggregated && aggregated > 36) return aggregated.toString();

                // If persisted is valid and non-default/non-zero/non-empty, use it (User edit)
                if (pStr && pStr !== defaultVal && pStr !== '0' && pStr !== '') return pStr;

                // If persisted is default/zero, but we have aggregated data, use aggregated
                if (aggregated && aggregated > 0) return aggregated.toString();

                return pStr || defaultVal;
            };

            const resolveText = (persisted: string, aggregated: string) => {
                if (persisted && persisted !== '') return persisted;
                if (aggregated && aggregated !== '') return aggregated;
                return '';
            };

            setFormState(prev => ({
                ...prev,
                exchangeRate: resolveValue('exchangeRate', persistedState.exchangeRateInput, agg?.exchangeRate, '36.00'),
                cashAvailable: resolveValue('cashAvailable', persistedState.cashAvailableInput, agg?.cashBs, '0'),
                cashAvailableUsd: resolveValue('cashAvailableUsd', persistedState.cashAvailableUsdInput, agg?.cashUsd, '0'),
                closureNotes: resolveText(persistedState.closureNotesInput, agg?.closureNotes || ''),
                applyExcessUsd: persistedState.applyExcessUsdSwitch ?? prev.applyExcessUsd,
                additionalAmountBs: resolveValue('additionalAmountBs', persistedState.additionalAmountBsInput, agg?.addBs, '0'),
                additionalAmountUsd: resolveValue('additionalAmountUsd', persistedState.additionalAmountUsdInput, agg?.addUsd, '0'),
                additionalNotes: resolveText(persistedState.additionalNotesInput, agg?.addNotes || ''),
                pendingPrizes: resolveValue('pendingPrizes', persistedState.pendingPrizesInput, agg?.pendingPrizesBs, '0'),
                pendingPrizesUsd: resolveValue('pendingPrizesUsd', persistedState.pendingPrizesUsdInput, agg?.pendingPrizesUsd, '0'),
            }));
        }
    }, [hasLoadedFromStorage, persistedState, fetchedData]);

    // Save to storage - only after data has been loaded to avoid persisting defaults
    const formInitializedRef = useRef(false);
    useEffect(() => {
        if (!fetchedData) return; // Don't save before data loads
        if (!formInitializedRef.current) {
            // Skip the first save cycle after data loads (it's the initialization)
            formInitializedRef.current = true;
            return;
        }
        if (!fetchedData?.summaryData?.daily_closure_confirmed && formState) {
            saveToStorage({
                ...cuadre,
                exchangeRate: parseFloat(formState.exchangeRate),
                cashAvailable: parseFloat(formState.cashAvailable),
                cashAvailableUsd: parseFloat(formState.cashAvailableUsd),
                closureNotes: formState.closureNotes,
                applyExcessUsd: formState.applyExcessUsd,
                additionalAmountBs: parseFloat(formState.additionalAmountBs),
                additionalAmountUsd: parseFloat(formState.additionalAmountUsd),
                additionalNotes: formState.additionalNotes,
                pendingPrizes: parseFloat(formState.pendingPrizes)
            } as any);
        }
    }, [formState, saveToStorage, cuadre, fetchedData]);


    // 5. Mutation for Save
    const saveMutation = useMutation({
        mutationFn: async ({ inputs, approve }: { inputs: any, approve: boolean }) => {
            if (!user || !selectedAgency || !selectedDate) throw new Error("Missing data");
            const dateStr = formatDateForDB(selectedDate);

            // Calculate final totals using inputs (redundant but safe)
            // Or use the `totals` from `cuadre` derived state if we trust inputs matched formState.
            // Let's use `inputs` passed to handleSave to be consistent with original logic.
            // But wait, the original logic called calculateTotals(inputs).
            // We can reuse calculateCuadreTotals.
            const totals = calculateCuadreTotals({
                totalSales: cuadre.totalSales,
                totalPrizes: cuadre.totalPrizes,
                totalGastos: cuadre.totalGastos,
                totalDeudas: cuadre.totalDeudas,
                pagoMovilRecibidos: cuadre.pagoMovilRecibidos,
                pagoMovilPagados: cuadre.pagoMovilPagados,
                totalPointOfSale: cuadre.totalPointOfSale,
                cashAvailable: parseFloat(inputs.cashAvailableInput) || 0,
                cashAvailableUsd: parseFloat(inputs.cashAvailableUsdInput) || 0,
                pendingPrizes: parseFloat(inputs.pendingPrizesInput) || 0,
                pendingPrizesUsd: parseFloat(inputs.pendingPrizesUsdInput) || 0,
                additionalAmountBs: parseFloat(inputs.additionalAmountBsInput) || 0,
                additionalAmountUsd: parseFloat(inputs.additionalAmountUsdInput) || 0,
                exchangeRate: parseFloat(inputs.exchangeRateInput) || 36.0,
                applyExcessUsd: inputs.applyExcessUsdSwitch
            });

            const notesData = {
                additionalAmountBs: parseFloat(inputs.additionalAmountBsInput) || 0,
                additionalAmountUsd: parseFloat(inputs.additionalAmountUsdInput) || 0,
                additionalNotes: inputs.additionalNotesInput,
                applyExcessUsd: inputs.applyExcessUsdSwitch
            };

            const summaryData = {
                user_id: user.id,
                agency_id: selectedAgency,
                session_date: dateStr,
                session_id: null,
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
                pending_prizes: parseFloat(inputs.pendingPrizesInput) || 0,
                pending_prizes_usd: parseFloat(inputs.pendingPrizesUsdInput) || 0,
                balance_before_pending_prizes_bs: totals.sumatoriaBolivares - totals.cuadreVentasPremios.bs,
                diferencia_final: totals.diferenciaFinal,
                balance_bs: totals.diferenciaFinal,
                excess_usd: totals.excessUsd,
                exchange_rate: parseFloat(inputs.exchangeRateInput) || 36,
                cash_available_bs: parseFloat(inputs.cashAvailableInput) || 0,
                cash_available_usd: parseFloat(inputs.cashAvailableUsdInput) || 0,
                closure_notes: inputs.closureNotesInput,
                notes: JSON.stringify(notesData),
                daily_closure_confirmed: true,
                is_closed: true,
                ...(approve ? {
                    encargada_status: "aprobado",
                    encargada_reviewed_by: user.id,
                    encargada_reviewed_at: new Date().toISOString(),
                    encargada_observations: null
                } : {})
            };

            // DB Update
            const { data: existingSummary } = await supabase.from("daily_cuadres_summary")
                .select("id")
                .eq("agency_id", selectedAgency)
                .eq("session_date", dateStr)
                .is("session_id", null)
                .maybeSingle();

            if (existingSummary?.id) {
                await supabase.from("daily_cuadres_summary").update(summaryData).eq("id", existingSummary.id);
            } else {
                await supabase.from("daily_cuadres_summary").insert(summaryData);
            }

            // Approve Taquilleras
            if (approve) {
                const { data: taquilleras } = await supabase.from("profiles").select("user_id").eq("agency_id", selectedAgency).eq("role", "taquillero").eq("is_active", true);
                if (taquilleras?.length) {
                    const tIds = taquilleras.map(t => t.user_id);
                    const { data: sessions } = await supabase.from("daily_sessions").select("id").eq("session_date", dateStr).in("user_id", tIds);
                    const sIds = sessions?.map(s => s.id) || [];
                    if (sIds.length > 0) {
                        await supabase.from("daily_cuadres_summary").update({
                            encargada_status: "aprobado",
                            encargada_reviewed_by: user.id,
                            encargada_reviewed_at: new Date().toISOString()
                        }).eq("session_date", dateStr).eq("agency_id", selectedAgency).in("session_id", sIds);
                    }
                }
            }

            return { approve };
        },
        onSuccess: (data) => {
            clearStorage();
            toast({
                title: data.approve ? "¡Día Aprobado!" : "Progreso Guardado",
                description: data.approve ? `Se ha cerrado y aprobado el día correctamente.` : "Se han guardado los datos del cierre."
            });

            const sessionDate = new Date(formatDateForDB(selectedDate) + 'T00:00:00');
            const weekStart = startOfWeek(sessionDate, { weekStartsOn: 1 });
            window.dispatchEvent(new CustomEvent('cuadre-saved', {
                detail: {
                    agency_id: selectedAgency,
                    session_date: formatDateForDB(selectedDate),
                    week_start_date: format(weekStart, 'yyyy-MM-dd')
                }
            }));

            queryClient.invalidateQueries({ queryKey: ['cuadre-general', selectedAgency] });
        },
        onError: (error) => {
            const appError = handleError(error);
            toast({ title: "Error", description: appError.message, variant: "destructive" });
        }
    });

    const handleSave = async (inputs: any, approve: boolean = false) => {
        saveMutation.mutate({ inputs, approve });
    };

    // Calculate totals helper for UI usage if needed, though we return `totals` in `cuadre`
    // The UI currently calls `calculateTotals(inputs)` manually on change.
    const calculateTotals = (inputs: any) => {
        return calculateCuadreTotals({
            totalSales: cuadre.totalSales,
            totalPrizes: cuadre.totalPrizes,
            totalGastos: cuadre.totalGastos,
            totalDeudas: cuadre.totalDeudas,
            pagoMovilRecibidos: cuadre.pagoMovilRecibidos,
            pagoMovilPagados: cuadre.pagoMovilPagados,
            totalPointOfSale: cuadre.totalPointOfSale,
            cashAvailable: parseFloat(inputs.cashAvailableInput) || 0,
            cashAvailableUsd: parseFloat(inputs.cashAvailableUsdInput) || 0,
            pendingPrizes: parseFloat(inputs.pendingPrizesInput) || 0,
            pendingPrizesUsd: parseFloat(inputs.pendingPrizesUsdInput) || 0,
            additionalAmountBs: parseFloat(inputs.additionalAmountBsInput) || 0,
            additionalAmountUsd: parseFloat(inputs.additionalAmountUsdInput) || 0,
            exchangeRate: parseFloat(inputs.exchangeRateInput) || 36.0,
            applyExcessUsd: inputs.applyExcessUsdSwitch
        });
    }

    return {
        loading: isLoading,
        saving: saveMutation.isPending && !saveMutation.variables?.approve,
        approving: saveMutation.isPending && saveMutation.variables?.approve,
        cuadre: {
            ...cuadre,
            // Map form state to cuadre fields if needed by UI
            exchangeRate: parseFloat(formState.exchangeRate),
            cashAvailable: parseFloat(formState.cashAvailable),
            cashAvailableUsd: parseFloat(formState.cashAvailableUsd),
            closureNotes: formState.closureNotes,
            applyExcessUsd: formState.applyExcessUsd,
            additionalAmountBs: parseFloat(formState.additionalAmountBs),
            additionalAmountUsd: parseFloat(formState.additionalAmountUsd),
            additionalNotes: formState.additionalNotes
        },
        setCuadre: (newState: any) => {
            // Adapt legacy setCuadre to setFormState
            // usage: setCuadre(prev => ({...prev, exchangeRate: ...}))
            // This is tricky because `newState` might be a function.
            // And `cuadre` returned here is derived.
            // We need to intercept updates to specific fields and update `formState`.
            // If the UI calls setCuadre directly, we're in trouble unless we expose a specific setter.
            // Better to return `setFormState` or a proxy `setCuadre`.

            // Assume the component passes an updater function or object
            const update = typeof newState === 'function' ? newState(cuadre) : newState;

            setFormState(prev => ({
                ...prev,
                exchangeRate: update.exchangeRate?.toString() || prev.exchangeRate,
                cashAvailable: update.cashAvailable?.toString() || prev.cashAvailable,
                cashAvailableUsd: update.cashAvailableUsd?.toString() || prev.cashAvailableUsd,
                closureNotes: update.closureNotes || prev.closureNotes,
                applyExcessUsd: update.applyExcessUsd ?? prev.applyExcessUsd,
                additionalAmountBs: update.additionalAmountBs?.toString() || prev.additionalAmountBs,
                additionalAmountUsd: update.additionalAmountUsd?.toString() || prev.additionalAmountUsd,
                additionalNotes: update.additionalNotes || prev.additionalNotes,
                pendingPrizes: update.pendingPrizes?.toString() || prev.pendingPrizes,
                pendingPrizesUsd: update.pendingPrizesUsd?.toString() || prev.pendingPrizesUsd
            }));
        },
        agencyName,
        reviewStatus,
        reviewObservations,
        reviewedBy,
        reviewedAt,
        persistedState,
        hasLoadedFromStorage,
        saveToStorage,
        calculateTotals,
        handleSave,
        fetchCuadreData: refetch,
        refresh: refetch,
        taquilleraDefaults: fetchedData?.aggregated || null
    };
};
