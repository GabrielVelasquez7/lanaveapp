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
    buildFallbackProfileFromUser(authUser: User): UserProfile {
        return buildFallbackProfile(authUser.id, authUser);
    },

    async getUserProfile(userId: string, authUser?: User | null): Promise<UserProfile | null> {
        try {
            // Run both queries in parallel
            const [profileResult, roleResult] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, user_id, full_name, role, agency_name, is_active')
                    .eq('user_id', userId)
                    .limit(1)
                    .maybeSingle(),
                supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', userId)
                    .limit(1)
                    .maybeSingle()
            ]);

            if (profileResult.error && profileResult.error.code !== 'PGRST116') {
                console.error('Error fetching profile:', profileResult.error);
            }

            if (roleResult.error && roleResult.error.code !== 'PGRST116') {
                console.error('Error fetching role:', roleResult.error);
            }

            const normalizedRole = normalizeRole(roleResult.data?.role || profileResult.data?.role);

            if (profileResult.data) {
                return {
                    ...profileResult.data,
                    role: normalizedRole
                };
            }

            return buildFallbackProfile(userId, authUser, roleResult.data?.role);
        } catch (error) {
            console.error('Error in getUserProfile:', error);
            return buildFallbackProfile(userId, authUser);
        }
    },

    async signOut() {
        return await supabase.auth.signOut();
    }
};
