import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDateForDB } from "@/lib/dateUtils";
import { startOfWeek, format } from "date-fns";
import { useCuadrePersistence, PersistedFormState } from "./useCuadrePersistence";
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
    totals?: any;
}

/**
 * FormState is the SINGLE SOURCE OF TRUTH for all editable fields.
 * All values are strings (for direct use in <input> elements) except applyExcessUsd.
 * This same shape is persisted to localStorage via useCuadrePersistence.
 */
export interface FormState {
    exchangeRate: string;
    cashAvailable: string;
    cashAvailableUsd: string;
    pendingPrizes: string;
    pendingPrizesUsd: string;
    closureNotes: string;
    additionalAmountBs: string;
    additionalAmountUsd: string;
    additionalNotes: string;
    applyExcessUsd: boolean;
}

const DEFAULT_FORM_STATE: FormState = {
    exchangeRate: '36.00',
    cashAvailable: '0',
    cashAvailableUsd: '0',
    pendingPrizes: '0',
    pendingPrizesUsd: '0',
    closureNotes: '',
    additionalAmountBs: '0',
    additionalAmountUsd: '0',
    additionalNotes: '',
    applyExcessUsd: true,
};

export const useCuadreGeneral = (
    selectedAgency: string,
    selectedDate: Date
) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // === SINGLE SOURCE OF TRUTH: formState ===
    const [formState, setFormState] = useState<FormState>({ ...DEFAULT_FORM_STATE });

    const [reviewStatus, setReviewStatus] = useState<string | null>(null);
    const [reviewedBy, setReviewedBy] = useState<string | null>(null);
    const [reviewedAt, setReviewedAt] = useState<string | null>(null);
    const [reviewObservations, setReviewObservations] = useState<string | null>(null);
    const [agencyName, setAgencyName] = useState<string>("");

    // Track whether formState has been initialized from data sources
    const formInitializedRef = useRef(false);
    const lastDateAgencyRef = useRef<string>('');

    // === Setter for individual fields (exposed to component) ===
    const NUMERIC_FIELDS: Array<keyof FormState> = [
        'exchangeRate', 'cashAvailable', 'cashAvailableUsd',
        'pendingPrizes', 'pendingPrizesUsd',
        'additionalAmountBs', 'additionalAmountUsd',
    ];

    const setFormField = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    }, []);

    // Normalize empty numeric fields to '0' on blur
    const blurFormField = useCallback(<K extends keyof FormState>(field: K) => {
        if (NUMERIC_FIELDS.includes(field)) {
            setFormState(prev => {
                const val = prev[field];
                if (val === '' || val === undefined || val === null) {
                    return { ...prev, [field]: '0' };
                }
                return prev;
            });
        }
    }, []);

    // === 1. Fetch Data ===
    const { data: fetchedData, isLoading, refetch } = useQuery({
        queryKey: ['cuadre-general', selectedAgency, formatDateForDB(selectedDate)],
        queryFn: async () => {
            if (!user || !selectedAgency || !selectedDate) return null;
            const dateStr = formatDateForDB(selectedDate);

            const detailsData = await transactionService.getEncargadaDetails(selectedAgency, dateStr, user.id);

            let totalSales = { bs: 0, usd: 0 };
            let totalPrizes = { bs: 0, usd: 0 };
            let taquilleraTotals = { sales: { bs: 0, usd: 0 }, prizes: { bs: 0, usd: 0 } };
            let taquilleraSessionIds: string[] = [];
            let sessionObjects: any[] = [];

            // ALWAYS fetch taquillera sessions and raw totals
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

                    // Always fetch raw taquillera sales/prizes for comparison
                    const [sales, prizes] = await Promise.all([
                        transactionService.getSales(taquilleraSessionIds),
                        transactionService.getPrizes(taquilleraSessionIds)
                    ]);

                    taquilleraTotals = {
                        sales: {
                            bs: sales.reduce((sum: any, s: any) => sum + Number(s.amount_bs || 0), 0),
                            usd: sales.reduce((sum: any, s: any) => sum + Number(s.amount_usd || 0), 0)
                        },
                        prizes: {
                            bs: prizes.reduce((sum: any, s: any) => sum + Number(s.amount_bs || 0), 0),
                            usd: prizes.reduce((sum: any, s: any) => sum + Number(s.amount_usd || 0), 0)
                        }
                    };
                }
            }

            if (detailsData && detailsData.length > 0) {
                // Use encargada's data as the authoritative totals
                totalSales = {
                    bs: detailsData.reduce((sum: any, d: any) => sum + Number(d.sales_bs || 0), 0),
                    usd: detailsData.reduce((sum: any, d: any) => sum + Number(d.sales_usd || 0), 0)
                };
                totalPrizes = {
                    bs: detailsData.reduce((sum: any, d: any) => sum + Number(d.prizes_bs || 0), 0),
                    usd: detailsData.reduce((sum: any, d: any) => sum + Number(d.prizes_usd || 0), 0)
                };
            } else {
                // No encargada data yet, use taquillera's raw totals
                totalSales = { ...taquilleraTotals.sales };
                totalPrizes = { ...taquilleraTotals.prizes };
            }

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
                cashBs: 0, cashUsd: 0, exchangeRate: 0, closureNotes: '',
                addBs: 0, addUsd: 0, addNotes: '',
                pendingPrizesBs: 0, pendingPrizesUsd: 0
            };

            if (sessionObjects.length > 0) {
                aggregated.cashBs = sessionObjects.reduce((sum, s) => sum + Number(s.cash_available_bs || 0), 0);
                aggregated.cashUsd = sessionObjects.reduce((sum, s) => sum + Number(s.cash_available_usd || 0), 0);
                aggregated.exchangeRate = sessionObjects.reduce((max, s) => Math.max(max, Number(s.exchange_rate || 0)), 0);
                aggregated.closureNotes = sessionObjects
                    .map(s => s.closure_notes)
                    .filter(Boolean)
                    .join("\n\n-- Taquillera --\n");

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
            }

            if (pendingPrizesList && pendingPrizesList.length > 0) {
                aggregated.pendingPrizesBs = pendingPrizesList.filter((p: any) => !p.is_paid).reduce((sum: number, p: any) => sum + Number(p.amount_bs || 0), 0);
                aggregated.pendingPrizesUsd = pendingPrizesList.filter((p: any) => !p.is_paid).reduce((sum: number, p: any) => sum + Number(p.amount_usd || 0), 0);
            }

            return {
                totalSales, totalPrizes, taquilleraTotals,
                expensesList, uniqueMobile, uniquePos,
                summaryData,
                agencyName: agencyResult.data?.name || "",
                aggregated
            };
        },
        enabled: !!user && !!selectedAgency && !!selectedDate,
        refetchOnMount: 'always' as const,
        staleTime: 0,
    });

    // === 2. Persistence ===
    const {
        persistedState,
        hasLoadedFromStorage,
        saveToStorage,
        clearStorage
    } = useCuadrePersistence(selectedAgency, selectedDate, !isLoading);

    // === 3. Initialize formState: Priority = localStorage > DB summary > taquillera aggregated ===
    useEffect(() => {
        const dateAgencyKey = `${selectedAgency}:${formatDateForDB(selectedDate)}`;

        // Reset when date/agency changes
        if (lastDateAgencyRef.current !== dateAgencyKey) {
            formInitializedRef.current = false;
            lastDateAgencyRef.current = dateAgencyKey;
        }

        // Don't init until data is loaded
        if (!fetchedData || isLoading) return;
        // Don't re-init if already done for this date/agency
        if (formInitializedRef.current) return;

        const { summaryData, aggregated } = fetchedData;

        // Set review metadata
        if (summaryData) {
            setReviewStatus(summaryData.encargada_status || "pendiente");
            setReviewObservations(summaryData.encargada_observations);
            setReviewedBy(summaryData.encargada_reviewed_by);
            setReviewedAt(summaryData.encargada_reviewed_at);
        } else {
            setReviewStatus(null);
            setReviewObservations(null);
            setReviewedBy(null);
            setReviewedAt(null);
        }
        if (fetchedData.agencyName) setAgencyName(fetchedData.agencyName);

        // Build base from taquillera aggregated data
        const taqBase: FormState = {
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

        // Overlay DB summary values if they exist
        let dbOverlay: Partial<FormState> = {};
        if (summaryData) {
            let notesData: any = {};
            try {
                if (summaryData.notes) notesData = JSON.parse(summaryData.notes);
            } catch (e) { }

            const summaryExchangeRate = Number(summaryData.exchange_rate || 0);
            const summaryCashBs = Number(summaryData.cash_available_bs || 0);
            const summaryCashUsd = Number(summaryData.cash_available_usd || 0);
            const summaryPending = Number(summaryData.pending_prizes || 0);
            const summaryPendingUsd = Number(summaryData.pending_prizes_usd || 0);

            dbOverlay = {
                exchangeRate: summaryExchangeRate > 36 || summaryData.closure_notes ? summaryExchangeRate.toString() : undefined,
                cashAvailable: summaryCashBs.toString(),
                cashAvailableUsd: summaryCashUsd.toString(),
                closureNotes: summaryData.closure_notes || undefined,
                applyExcessUsd: notesData.applyExcessUsd ?? undefined,
                additionalAmountBs: notesData.additionalAmountBs !== undefined ? Number(notesData.additionalAmountBs).toString() : undefined,
                additionalAmountUsd: notesData.additionalAmountUsd !== undefined ? Number(notesData.additionalAmountUsd).toString() : undefined,
                additionalNotes: notesData.additionalNotes || undefined,
                pendingPrizes: summaryPending.toString(),
                pendingPrizesUsd: summaryPendingUsd.toString(),
            };
        }

        // Merge: taqBase < dbOverlay < localStorage (highest priority)
        const merged: FormState = { ...taqBase };

        // Apply DB overlay (non-undefined values)
        for (const key of Object.keys(dbOverlay) as Array<keyof FormState>) {
            if (dbOverlay[key] !== undefined) {
                (merged as any)[key] = dbOverlay[key];
            }
        }

        // Apply localStorage values (highest priority, only if not closed)
        if (hasLoadedFromStorage && persistedState && !summaryData?.daily_closure_confirmed) {
            const isNonDefault = (val: string | undefined, defaultVal: string) => {
                return val !== undefined && val !== defaultVal && val !== '';
            };

            if (isNonDefault(persistedState.exchangeRate, '36.00')) merged.exchangeRate = persistedState.exchangeRate;
            if (isNonDefault(persistedState.cashAvailable, '0')) merged.cashAvailable = persistedState.cashAvailable;
            if (isNonDefault(persistedState.cashAvailableUsd, '0')) merged.cashAvailableUsd = persistedState.cashAvailableUsd;
            if (persistedState.pendingPrizes !== undefined) merged.pendingPrizes = persistedState.pendingPrizes;
            if (persistedState.pendingPrizesUsd !== undefined) merged.pendingPrizesUsd = persistedState.pendingPrizesUsd;
            if (isNonDefault(persistedState.closureNotes, '')) merged.closureNotes = persistedState.closureNotes;
            if (isNonDefault(persistedState.additionalAmountBs, '0')) merged.additionalAmountBs = persistedState.additionalAmountBs;
            if (isNonDefault(persistedState.additionalAmountUsd, '0')) merged.additionalAmountUsd = persistedState.additionalAmountUsd;
            if (isNonDefault(persistedState.additionalNotes, '')) merged.additionalNotes = persistedState.additionalNotes;
            if (persistedState.applyExcessUsd !== undefined) merged.applyExcessUsd = persistedState.applyExcessUsd;
        }

        setFormState(merged);
        formInitializedRef.current = true;

    }, [fetchedData, isLoading, hasLoadedFromStorage, persistedState, selectedAgency, selectedDate]);


    // === 4. Auto-persist formState changes to localStorage ===
    const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        // Only persist after initialization, not during loading, and not if closed
        if (!formInitializedRef.current || isLoading) return;
        if (fetchedData?.summaryData?.daily_closure_confirmed) return;

        // Debounce persistence writes
        if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
        persistTimerRef.current = setTimeout(() => {
            saveToStorage(formState as PersistedFormState);
        }, 300);

        return () => {
            if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
        };
    }, [formState, saveToStorage, isLoading, fetchedData]);


    // === 5. Derived CuadreData (read-only, for display) ===
    const cuadre = useMemo<CuadreData>(() => {
        if (!fetchedData) {
            return {
                totalSales: { bs: 0, usd: 0 },
                totalPrizes: { bs: 0, usd: 0 },
                totalGastos: { bs: 0, usd: 0 },
                totalDeudas: { bs: 0, usd: 0 },
                gastosDetails: [], deudasDetails: [],
                pagoMovilRecibidos: 0, pagoMovilPagados: 0,
                totalPointOfSale: 0, pendingPrizes: 0,
                cashAvailable: 0, cashAvailableUsd: 0,
                closureConfirmed: false, closureNotes: "",
                exchangeRate: 36.0, applyExcessUsd: true,
                additionalAmountBs: 0, additionalAmountUsd: 0,
                additionalNotes: "", totals: {}
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
            pendingPrizes: Number(summaryData?.pending_prizes || 0),
            cashAvailable: Number(summaryData?.cash_available_bs || 0),
            cashAvailableUsd: Number(summaryData?.cash_available_usd || 0),
            closureConfirmed: summaryData?.daily_closure_confirmed || false,
            closureNotes: summaryData?.closure_notes || "",
            exchangeRate: Number(summaryData?.exchange_rate || 36.0),
            applyExcessUsd: true,
            additionalAmountBs: 0, additionalAmountUsd: 0,
            additionalNotes: "",
            totals
        };
    }, [fetchedData, formState]);


    // === 6. Save Mutation ===
    const saveMutation = useMutation({
        mutationFn: async ({ approve }: { approve: boolean }) => {
            if (!user || !selectedAgency || !selectedDate) throw new Error("Missing data");
            const dateStr = formatDateForDB(selectedDate);

            const totals = calculateCuadreTotals({
                totalSales: cuadre.totalSales,
                totalPrizes: cuadre.totalPrizes,
                totalGastos: cuadre.totalGastos,
                totalDeudas: cuadre.totalDeudas,
                pagoMovilRecibidos: cuadre.pagoMovilRecibidos,
                pagoMovilPagados: cuadre.pagoMovilPagados,
                totalPointOfSale: cuadre.totalPointOfSale,
                cashAvailable: parseFloat(formState.cashAvailable) || 0,
                cashAvailableUsd: parseFloat(formState.cashAvailableUsd) || 0,
                pendingPrizes: parseFloat(formState.pendingPrizes) || 0,
                pendingPrizesUsd: parseFloat(formState.pendingPrizesUsd) || 0,
                additionalAmountBs: parseFloat(formState.additionalAmountBs) || 0,
                additionalAmountUsd: parseFloat(formState.additionalAmountUsd) || 0,
                exchangeRate: parseFloat(formState.exchangeRate) || 36.0,
                applyExcessUsd: formState.applyExcessUsd
            });

            const notesData = {
                additionalAmountBs: parseFloat(formState.additionalAmountBs) || 0,
                additionalAmountUsd: parseFloat(formState.additionalAmountUsd) || 0,
                additionalNotes: formState.additionalNotes,
                applyExcessUsd: formState.applyExcessUsd
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
                pending_prizes: parseFloat(formState.pendingPrizes) || 0,
                pending_prizes_usd: parseFloat(formState.pendingPrizesUsd) || 0,
                balance_before_pending_prizes_bs: totals.sumatoriaBolivares - totals.cuadreVentasPremios.bs,
                diferencia_final: totals.diferenciaFinal,
                balance_bs: totals.diferenciaFinal,
                excess_usd: totals.excessUsd,
                exchange_rate: parseFloat(formState.exchangeRate) || 36,
                cash_available_bs: parseFloat(formState.cashAvailable) || 0,
                cash_available_usd: parseFloat(formState.cashAvailableUsd) || 0,
                closure_notes: formState.closureNotes,
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

    const handleSave = useCallback(async (approve: boolean = false) => {
        saveMutation.mutate({ approve });
    }, [saveMutation]);

    // Calculate totals for UI usage
    const calculateTotals = useCallback(() => {
        return calculateCuadreTotals({
            totalSales: cuadre.totalSales,
            totalPrizes: cuadre.totalPrizes,
            totalGastos: cuadre.totalGastos,
            totalDeudas: cuadre.totalDeudas,
            pagoMovilRecibidos: cuadre.pagoMovilRecibidos,
            pagoMovilPagados: cuadre.pagoMovilPagados,
            totalPointOfSale: cuadre.totalPointOfSale,
            cashAvailable: parseFloat(formState.cashAvailable) || 0,
            cashAvailableUsd: parseFloat(formState.cashAvailableUsd) || 0,
            pendingPrizes: parseFloat(formState.pendingPrizes) || 0,
            pendingPrizesUsd: parseFloat(formState.pendingPrizesUsd) || 0,
            additionalAmountBs: parseFloat(formState.additionalAmountBs) || 0,
            additionalAmountUsd: parseFloat(formState.additionalAmountUsd) || 0,
            exchangeRate: parseFloat(formState.exchangeRate) || 36.0,
            applyExcessUsd: formState.applyExcessUsd
        });
    }, [cuadre, formState]);

    return {
        loading: isLoading,
        saving: saveMutation.isPending && !saveMutation.variables?.approve,
        approving: saveMutation.isPending && saveMutation.variables?.approve,
        cuadre,
        formState,
        setFormField,
        blurFormField,
        agencyName,
        reviewStatus,
        reviewObservations,
        reviewedBy,
        reviewedAt,
        calculateTotals,
        handleSave,
        fetchCuadreData: refetch,
        refresh: refetch,
        taquilleraDefaults: fetchedData?.aggregated || null
    };
};
