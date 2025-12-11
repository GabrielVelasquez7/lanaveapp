import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  role: 'taquillero' | 'administrador' | 'encargada';
  agency_name?: string;
  is_active: boolean;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Set up auth listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        setUser(session?.user ?? null);
        setSession(session);
        
        if (session?.user) {
          // Use setTimeout to prevent blocking the auth state change
          setTimeout(() => {
            if (mounted) {
              fetchProfile(session.user.id);
            }
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session with timeout
    const checkSession = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        );
        
        const sessionPromise = supabase.auth.getSession();
        
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any;
        
        if (mounted) {
          setUser(session?.user ?? null);
          setSession(session);
          
          if (session?.user) {
            setTimeout(() => {
              if (mounted) {
                fetchProfile(session.user.id);
              }
            }, 0);
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Session check failed:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      // Get current user for metadata fallback
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      }

      // Fetch role from user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Error fetching role:', roleError);
      }

      // If profile exists, use it with role
      if (profileData) {
        const roleValue = roleData?.role || profileData.role || 'taquillero';
        // Map old 'encargado' role to 'encargada'
        const normalizedRole = roleValue === 'encargado' ? 'encargada' : roleValue;
        const completeProfile = {
          ...profileData,
          role: normalizedRole as UserProfile['role']
        };
        setProfile(completeProfile);
      } else if (currentUser?.user_metadata) {
        // Fallback to user_metadata if no profile exists
        const metadata = currentUser.user_metadata;
        const fallbackProfile: UserProfile = {
          id: userId,
          user_id: userId,
          full_name: metadata.full_name || currentUser.email || 'Usuario',
          role: (roleData?.role || metadata.role || 'taquillero') as UserProfile['role'],
          agency_name: metadata.agency_name,
          is_active: true
        };
        setProfile(fallbackProfile);
      } else {
        // No profile and no metadata - set a basic profile
        const basicProfile: UserProfile = {
          id: userId,
          user_id: userId,
          full_name: 'Usuario',
          role: (roleData?.role || 'taquillero') as UserProfile['role'],
          is_active: true
        };
        setProfile(basicProfile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
  };
};