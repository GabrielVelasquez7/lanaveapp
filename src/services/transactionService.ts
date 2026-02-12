import { supabase } from '@/integrations/supabase/client';
import { mapSupabaseError } from '@/lib/errors';

export const transactionService = {
    async getSales(sessionIds: string[]) {
        if (!sessionIds.length) return [];
        const { data, error } = await supabase
            .from('sales_transactions')
            .select('amount_bs, amount_usd, session_id')
            .in('session_id', sessionIds);
        if (error) throw mapSupabaseError(error, 'Error obteniendo ventas');
        return data || [];
    },

    async getPrizes(sessionIds: string[]) {
        if (!sessionIds.length) return [];
        const { data, error } = await supabase
            .from('prize_transactions')
            .select('amount_bs, amount_usd, session_id')
            .in('session_id', sessionIds);
        if (error) throw mapSupabaseError(error, 'Error obteniendo premios');
        return data || [];
    },

    async getExpenses(sessionIds: string[], agencyId?: string, dateStr?: string) {
        let query = supabase.from('expenses').select('*');

        if (sessionIds.length > 0) {
            query = query.in('session_id', sessionIds);
        } else if (agencyId && dateStr) {
            // Fallback for direct agency/date query if needed, but usually we combine
            query = supabase.from('expenses').select('*').eq('agency_id', agencyId).eq('transaction_date', dateStr);
        } else {
            return [];
        }

        const { data, error } = await query;
        if (error) throw mapSupabaseError(error, 'Error obteniendo gastos');
        return data || [];
    },

    // Overload/Combined method for CuadreGeneral which needs both session-based and agency-date based
    async getExpensesCombined(sessionIds: string[], agencyId: string, dateStr: string) {
        const queries = [
            supabase.from('expenses').select('*').eq('agency_id', agencyId).eq('transaction_date', dateStr)
        ];

        if (sessionIds.length > 0) {
            queries.push(supabase.from('expenses').select('*').in('session_id', sessionIds));
        }

        const results = await Promise.all(queries);
        const all: any[] = [];
        results.forEach(r => {
            if (r.error) throw mapSupabaseError(r.error, 'Error en consulta combinada de gastos');
            if (r.data) all.push(...r.data);
        });

        // Deduplicate
        return Array.from(new Map(all.map(item => [item.id, item])).values());
    },

    async getMobilePaymentsCombined(sessionIds: string[], agencyId: string, dateStr: string) {
        const queries = [
            supabase.from('mobile_payments').select('*').eq('agency_id', agencyId).eq('transaction_date', dateStr)
        ];

        if (sessionIds.length > 0) {
            queries.push(supabase.from('mobile_payments').select('*').in('session_id', sessionIds));
        }

        const results = await Promise.all(queries);
        const all: any[] = [];
        results.forEach(r => {
            if (r.error) throw mapSupabaseError(r.error, 'Error en consulta combinada de pago móvil');
            if (r.data) all.push(...r.data);
        });
        return Array.from(new Map(all.map(item => [item.id, item])).values());
    },

    async getPointOfSaleCombined(sessionIds: string[], agencyId: string, dateStr: string) {
        const queries = [
            supabase.from('point_of_sale').select('*').eq('agency_id', agencyId).eq('transaction_date', dateStr)
        ];

        if (sessionIds.length > 0) {
            queries.push(supabase.from('point_of_sale').select('*').in('session_id', sessionIds));
        }

        const results = await Promise.all(queries);
        const all: any[] = [];
        results.forEach(r => {
            if (r.error) throw mapSupabaseError(r.error, 'Error en consulta combinada de punto de venta');
            if (r.data) all.push(...r.data);
        });
        return Array.from(new Map(all.map(item => [item.id, item])).values());
    },

    async getMobilePayments(sessionIds: string[]) {
        if (!sessionIds.length) return [];
        const { data, error } = await supabase
            .from('mobile_payments')
            .select('*')
            .in('session_id', sessionIds);
        if (error) throw mapSupabaseError(error, 'Error obteniendo pagos móviles');
        return data || [];
    },

    async getPointOfSale(sessionIds: string[]) {
        if (!sessionIds.length) return [];
        const { data, error } = await supabase
            .from('point_of_sale')
            .select('*')
            .in('session_id', sessionIds);
        if (error) throw mapSupabaseError(error, 'Error obteniendo puntos de venta');
        return data || [];
    },

    async getPendingPrizes(sessionIds: string[]) {
        if (!sessionIds.length) return [];
        const { data, error } = await supabase
            .from('pending_prizes')
            .select('amount_bs, amount_usd, is_paid, session_id')
            .in('session_id', sessionIds);
        if (error) throw mapSupabaseError(error, 'Error obteniendo premios pendientes');
        return data || [];
    },

    async getEncargadaDetails(agencyId: string, dateStr: string, _userId?: string) {
        const { data, error } = await supabase
            .from("encargada_cuadre_details")
            .select("sales_bs, sales_usd, prizes_bs, prizes_usd")
            .eq("agency_id", agencyId)
            .eq("session_date", dateStr);

        if (error) throw mapSupabaseError(error, 'Error obteniendo detalles de encargada');
        return data || [];
    }
};
