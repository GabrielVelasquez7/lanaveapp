import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { handleError } from '@/lib/errors';
import { formatDateForDB } from '@/lib/dateUtils';
import { sessionService } from '@/services/sessionService';
import { transactionService } from '@/services/transactionService';
import { calculateCuadreTotals } from '@/lib/financialMath';
import { queryKeys } from '@/lib/queryKeys';

interface DateRange {
    from: Date;
    to: Date;
}

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
    premiosPorPagar: number;
    premiosPorPagarUsd: number;
    sessionId?: string;
    closureConfirmed: boolean;
    encargadaFeedback?: any;
    // Computed totals from financialMath
    totals: any;
}

export interface CuadreFormState {
    exchangeRate: string;
    cashAvailable: string;
    cashAvailableUsd: string;
    additionalAmountBs: string;
    additionalAmountUsd: string;
    additionalNotes: string;
    closureNotes: string;
    applyExcessUsd: boolean;
}

const DEFAULT_FORM_STATE: CuadreFormState = {
    exchangeRate: '36.00',
    cashAvailable: '0',
    cashAvailableUsd: '0',
    additionalAmountBs: '0',
    additionalAmountUsd: '0',
    additionalNotes: '',
    closureNotes: '',
    applyExcessUsd: true,
};

export const useTaquilleraCuadre = (dateRange: DateRange | undefined) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Form State (Local UI state)
    const [formState, setFormState] = useState<CuadreFormState>(DEFAULT_FORM_STATE);

    // 1. Fetch Session(s)
    const { data: sessions = [], isLoading: isLoadingSession } = useQuery({
        queryKey: queryKeys.session(user?.id, dateRange ? formatDateForDB(dateRange.from) : ''),
        queryFn: async () => {
            if (!user || !dateRange) return [];
            const from = formatDateForDB(dateRange.from);
            const to = formatDateForDB(dateRange.to);
            return sessionService.getSessionsByRange(user.id, from, to);
        },
        enabled: !!user && !!dateRange,
    });

    const sessionData = sessions[0];
    const sessionId = sessionData?.id;

    // 2. Fetch Transactions (Dependent on Session)
    const { data: transData, isLoading: isLoadingTransactions } = useQuery({
        queryKey: ['transactions-all', sessionId],
        queryFn: async () => {
            if (!sessionId) return null;
            const ids = [sessionId];

            const [sales, prizes, expenses, mobile, pos, pending, encargadaFeedback] = await Promise.all([
                transactionService.getSales(ids),
                transactionService.getPrizes(ids),
                transactionService.getExpenses(ids),
                transactionService.getMobilePayments(ids),
                transactionService.getPointOfSale(ids),
                transactionService.getPendingPrizes(ids),
                sessionService.getCuadreSummary(sessionId)
            ]);

            return { sales, prizes, expenses, mobile, pos, pending, encargadaFeedback };
        },
        enabled: !!sessionId,
    });

    // 3. Derived State (Aggregation)
    const cuadre = useMemo<CuadreData>(() => {
        const empty = { bs: 0, usd: 0 };
        if (!transData) {
            return {
                totalSales: empty, totalPrizes: empty, totalGastos: empty, totalDeudas: empty,
                gastosDetails: [], deudasDetails: [],
                pagoMovilRecibidos: 0, pagoMovilPagados: 0, totalPointOfSale: 0,
                premiosPorPagar: 0, premiosPorPagarUsd: 0,
                sessionId: undefined, closureConfirmed: false,
                totals: calculateCuadreTotals({
                    totalSales: empty, totalPrizes: empty, totalGastos: empty, totalDeudas: empty,
                    pagoMovilRecibidos: 0, pagoMovilPagados: 0, totalPointOfSale: 0,
                    cashAvailable: 0, cashAvailableUsd: 0,
                    pendingPrizes: 0, pendingPrizesUsd: 0,
                    additionalAmountBs: 0, additionalAmountUsd: 0,
                    exchangeRate: 0, applyExcessUsd: true
                })
            };
        }

        const { sales, prizes, expenses, mobile, pos, pending, encargadaFeedback } = transData;

        // Aggregations
        const totalSales = sales.reduce((acc: any, c: any) => ({ bs: acc.bs + (c.amount_bs || 0), usd: acc.usd + (c.amount_usd || 0) }), { bs: 0, usd: 0 });
        const totalPrizes = prizes.reduce((acc: any, c: any) => ({ bs: acc.bs + (c.amount_bs || 0), usd: acc.usd + (c.amount_usd || 0) }), { bs: 0, usd: 0 });

        const gastos = expenses.filter((e: any) => e.category === 'gasto_operativo');
        const totalGastos = gastos.reduce((acc: any, c: any) => ({ bs: acc.bs + (c.amount_bs || 0), usd: acc.usd + (c.amount_usd || 0) }), { bs: 0, usd: 0 });

        const deudas = expenses.filter((e: any) => e.category === 'deuda');
        const totalDeudas = deudas.reduce((acc: any, c: any) => ({ bs: acc.bs + (c.amount_bs || 0), usd: acc.usd + (c.amount_usd || 0) }), { bs: 0, usd: 0 });

        const pagoMovilRecibidos = mobile.reduce((sum: number, item: any) => sum + (item.amount_bs > 0 ? item.amount_bs : 0), 0);
        const pagoMovilPagados = Math.abs(mobile.reduce((sum: number, item: any) => sum + (item.amount_bs < 0 ? item.amount_bs : 0), 0));

        const totalPointOfSale = pos.reduce((sum: number, item: any) => sum + (item.amount_bs || 0), 0);

        const premiosPorPagar = pending.filter((p: any) => !p.is_paid).reduce((sum: number, item: any) => sum + (item.amount_bs || 0), 0);
        const premiosPorPagarUsd = pending.filter((p: any) => !p.is_paid).reduce((sum: number, item: any) => sum + (item.amount_usd || 0), 0);

        // Calculate financial totals
        const totals = calculateCuadreTotals({
            totalSales, totalPrizes, totalGastos, totalDeudas,
            pagoMovilRecibidos, pagoMovilPagados, totalPointOfSale,
            cashAvailable: parseFloat(formState.cashAvailable) || 0,
            cashAvailableUsd: parseFloat(formState.cashAvailableUsd) || 0,
            pendingPrizes: premiosPorPagar,
            pendingPrizesUsd: premiosPorPagarUsd,
            additionalAmountBs: parseFloat(formState.additionalAmountBs) || 0,
            additionalAmountUsd: parseFloat(formState.additionalAmountUsd) || 0,
            exchangeRate: parseFloat(formState.exchangeRate) || 0,
            applyExcessUsd: formState.applyExcessUsd
        });

        return {
            totalSales, totalPrizes, totalGastos, totalDeudas,
            gastosDetails: gastos, deudasDetails: deudas,
            pagoMovilRecibidos, pagoMovilPagados, totalPointOfSale,
            premiosPorPagar, premiosPorPagarUsd,
            sessionId,
            closureConfirmed: sessionData?.daily_closure_confirmed || false,
            encargadaFeedback,
            totals
        };
    }, [transData, sessionData, formState, sessionId]);


    // 4. Initialize Local State from Server Data (One-off sync)
    // We only want to do this when sessionData FIRST loads or changes
    useEffect(() => {
        if (!sessionData?.daily_closure_confirmed) {
            // If not closed, we might still want to load partial state or just Defaults/Storage
            // Logic for storage is handled separately below.
            // But if it IS closed, we MUST overwrite state from DB.
            return;
        }

        const encargadaFeedback = transData?.encargadaFeedback;
        let notes = { additionalAmountBs: 0, additionalAmountUsd: 0, additionalNotes: '', applyExcessUsd: true };
        if (encargadaFeedback?.notes) {
            try { notes = JSON.parse(encargadaFeedback.notes); } catch (e) { }
        }

        setFormState({
            exchangeRate: sessionData.exchange_rate?.toString() || '36.00',
            cashAvailable: sessionData.cash_available_bs?.toString() || '0',
            cashAvailableUsd: sessionData.cash_available_usd?.toString() || '0',
            closureNotes: sessionData.closure_notes || '',
            additionalAmountBs: notes.additionalAmountBs?.toString() || '0',
            additionalAmountUsd: notes.additionalAmountUsd?.toString() || '0',
            additionalNotes: notes.additionalNotes || '',
            applyExcessUsd: notes.applyExcessUsd ?? true
        });

    }, [sessionData, transData]); // Depend on sessionData and transData

    // 5. Local Storage (Persistence for Drafts)
    useEffect(() => {
        if (!user || !dateRange || cuadre.closureConfirmed) return;

        const key = `taq:cuadre-general:${user.id}:${formatDateForDB(dateRange.from)}`;

        // Load on mount (if not loaded yet)
        const saved = localStorage.getItem(key);
        if (saved && !sessionData?.daily_closure_confirmed) { // Only load if not closed
            // We need a way to only load ONCE. 
            // Ideally we check if form is dirty? 
            // For now, let's just assume if it's default state, we load.
            if (formState === DEFAULT_FORM_STATE && saved) {
                try {
                    setFormState(prev => ({ ...prev, ...JSON.parse(saved) }));
                } catch (e) { }
            }
        }

        // Save on change
        const timeout = setTimeout(() => {
            if (formState !== DEFAULT_FORM_STATE) {
                localStorage.setItem(key, JSON.stringify(formState));
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [user, dateRange, formState, cuadre.closureConfirmed, sessionData]);


    // 6. Mutation for Saving
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!user || !dateRange) throw new Error("Missing user or date");

            const sessionDate = formatDateForDB(dateRange.from);
            let targetSessionId = sessionId;

            // Create session if not exists
            if (!targetSessionId) {
                const newSession = await sessionService.createSession(user.id, sessionDate);
                targetSessionId = newSession?.id;
            }

            const notesJson = JSON.stringify({
                additionalAmountBs: formState.additionalAmountBs,
                additionalAmountUsd: formState.additionalAmountUsd,
                additionalNotes: formState.additionalNotes,
                applyExcessUsd: formState.applyExcessUsd
            });

            await sessionService.updateSession(targetSessionId!, {
                cash_available_bs: parseFloat(formState.cashAvailable),
                cash_available_usd: parseFloat(formState.cashAvailableUsd),
                exchange_rate: parseFloat(formState.exchangeRate),
                closure_notes: formState.closureNotes,
                daily_closure_confirmed: true
            });

            // Update Summary if exists (Encargada side)
            const existingSummary = await sessionService.getCuadreSummary(targetSessionId!);
            if (existingSummary) {
                await sessionService.updateCuadreSummary(targetSessionId!, {
                    notes: notesJson,
                    is_closed: true,
                    encargada_status: 'pendiente'
                });
            }

            // Clear storage
            const key = `taq:cuadre-general:${user.id}:${sessionDate}`;
            localStorage.removeItem(key);

            return targetSessionId; // Return ID for success handling
        },
        onSuccess: () => {
            toast({ title: 'Éxito', description: 'Cierre guardado correctamente' });
            queryClient.invalidateQueries({ queryKey: queryKeys.session(user?.id, dateRange ? formatDateForDB(dateRange.from) : '') });
            queryClient.invalidateQueries({ queryKey: ['transactions-all'] });
        },
        onError: (error) => {
            const appError = handleError(error);
            toast({ title: 'Error', description: appError.message, variant: 'destructive' });
        }
    });

    return {
        cuadre,
        formState,
        setFormState,
        loading: isLoadingSession || isLoadingTransactions,
        saving: saveMutation.isPending,
        refresh: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.session(user?.id, dateRange ? formatDateForDB(dateRange.from) : '') });
        },
        handleSaveClosure: saveMutation.mutate,
        totals: cuadre.totals // Expose pre-calculated totals
    };
};
