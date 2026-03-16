import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { UserProfile } from '@/hooks/useAuth';

const normalizeRole = (role?: string | null): UserProfile['role'] => {
    if (role === 'encargado') return 'encargada';
    if (role === 'administrador' || role === 'encargada') return role;
    return 'taquillero';
};

const buildFallbackProfile = (userId: string, authUser?: User | null, role?: string | null): UserProfile => {
    const metadata = authUser?.user_metadata ?? {};
    const fullName = [metadata.first_name, metadata.last_name].filter(Boolean).join(' ').trim();

    return {
        id: userId,
        user_id: userId,
        full_name: metadata.full_name || fullName || authUser?.email || 'Usuario',
        role: normalizeRole(role || metadata.role),
        agency_name: typeof metadata.agency_name === 'string' ? metadata.agency_name : undefined,
        is_active: true
    };
};

export const authService = {
    async getUserProfile(userId: string, authUser?: User | null): Promise<UserProfile | null> {
        try {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, user_id, full_name, role, agency_name, is_active')
                .eq('user_id', userId)
                .limit(1)
                .maybeSingle();

            if (profileError && profileError.code !== 'PGRST116') {
                console.error('Error fetching profile:', profileError);
            }

            const { data: roleData, error: roleError } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', userId)
                .limit(1)
                .maybeSingle();

            if (roleError && roleError.code !== 'PGRST116') {
                console.error('Error fetching role:', roleError);
            }

            const normalizedRole = normalizeRole(roleData?.role || profileData?.role);

            if (profileData) {
                return {
                    ...profileData,
                    role: normalizedRole
                };
            }

            return buildFallbackProfile(userId, authUser, roleData?.role);
        } catch (error) {
            console.error('Error in getUserProfile:', error);
            return buildFallbackProfile(userId, authUser);
        }
    },

    async signOut() {
        return await supabase.auth.signOut();
    }
};
