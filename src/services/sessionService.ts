import { supabase } from '@/integrations/supabase/client';
import { mapSupabaseError } from '@/lib/errors';

export const sessionService = {
    async getSessionByDate(userId: string, dateStr: string) {
        const { data, error } = await supabase
            .from('daily_sessions')
            .select('*')
            .eq('user_id', userId)
            .eq('session_date', dateStr)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw mapSupabaseError(error, 'Error buscando sesión');
        return data;
    },

    async getSessionsByRange(userId: string, fromDate: string, toDate: string) {
        const { data, error } = await supabase
            .from('daily_sessions')
            .select('*')
            .eq('user_id', userId)
            .gte('session_date', fromDate)
            .lte('session_date', toDate);

        if (error) throw mapSupabaseError(error, 'Error buscando sesiones en rango');
        return data || [];
    },

    async createSession(userId: string, dateStr: string) {
        // Get agency_id first
        const { data: profile } = await supabase
            .from('profiles')
            .select('agency_id')
            .eq('user_id', userId)
            .single();

        const { data, error } = await supabase
            .from('daily_sessions')
            .insert({
                user_id: userId,
                session_date: dateStr,
                agency_id: profile?.agency_id
            })
            .select()
            .single();

        if (error) throw mapSupabaseError(error, 'Error creando sesión');
        return data;
    },

    async updateSession(sessionId: string, updates: any) {
        const { data, error } = await supabase
            .from('daily_sessions')
            .update(updates)
            .eq('id', sessionId)
            .select()
            .single();

        if (error) throw mapSupabaseError(error, 'Error actualizando sesión');
        return data;
    },

    async getCuadreSummary(sessionId: string) {
        const { data, error } = await supabase
            .from('daily_cuadres_summary')
            .select('*')
            .eq('session_id', sessionId)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw mapSupabaseError(error, 'Error obteniendo resumen');
        return data;
    },

    async updateCuadreSummary(sessionId: string, updates: any) {
        const { error } = await supabase
            .from('daily_cuadres_summary')
            .update(updates)
            .eq('session_id', sessionId);

        if (error) throw mapSupabaseError(error, 'Error actualizando resumen');
    },

    async getAgencyId(userId: string) {
        const { data, error } = await supabase.from('profiles').select('agency_id').eq('user_id', userId).single();
        if (error && error.code !== 'PGRST116') throw mapSupabaseError(error, 'Error obteniendo agencia');
        return data?.agency_id;
    }
};
