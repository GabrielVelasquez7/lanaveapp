import { supabase } from '@/integrations/supabase/client';
import type { UserProfile } from '@/hooks/useAuth';

export const authService = {
    async getUserProfile(userId: string): Promise<UserProfile | null> {
        try {
            // Fetch profile data
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (profileError && profileError.code !== 'PGRST116') {
                console.error('Error fetching profile:', profileError);
                return null;
            }

            // Fetch role from user_roles
            const { data: roleData, error: roleError } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', userId)
                .maybeSingle();

            if (roleError && roleError.code !== 'PGRST116') {
                console.error('Error fetching role:', roleError);
            }

            if (profileData) {
                const roleValue = roleData?.role || profileData.role || 'taquillero';
                const normalizedRole = roleValue === 'encargado' ? 'encargada' : roleValue;

                return {
                    ...profileData,
                    role: normalizedRole as UserProfile['role']
                };
            }

            const { data: { user } } = await supabase.auth.getUser();

            if (user?.user_metadata) {
                const metadata = user.user_metadata;
                return {
                    id: userId,
                    user_id: userId,
                    full_name: metadata.full_name || user.email || 'Usuario',
                    role: (roleData?.role || metadata.role || 'taquillero') as UserProfile['role'],
                    agency_name: metadata.agency_name,
                    is_active: true
                };
            }

            return {
                id: userId,
                user_id: userId,
                full_name: 'Usuario',
                role: (roleData?.role || 'taquillero') as UserProfile['role'],
                is_active: true
            };

        } catch (error) {
            console.error('Error in getUserProfile:', error);
            return null;
        }
    },

    async signOut() {
        return await supabase.auth.signOut();
    }
};
