import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { authService } from '@/services/authService';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  role: 'taquillero' | 'administrador' | 'encargada';
  agency_name?: string;
  agency_id?: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ data: { user: User | null; session: Session | null }; error: any }>;
  signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Guards against re-entrancy and duplicate fetches
  const profileRef = useRef<UserProfile | null>(null);
  const lastResolvedUserIdRef = useRef<string | null>(null);
  const inFlightUserIdRef = useRef<string | null>(null);
  // Only honor SIGNED_OUT when user explicitly clicks "Salir" (protects against 429 refresh failures)
  const explicitSignOutRef = useRef(false);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    let mounted = true;

    const resetAuthState = () => {
      lastResolvedUserIdRef.current = null;
      inFlightUserIdRef.current = null;
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
    };

    const syncSession = async (nextSession: Session | null, event?: string) => {
      if (!mounted) return;

      const nextUser = nextSession?.user ?? null;

      // No user — reset, BUT only if it's an explicit sign out or we don't have a loaded profile
      if (!nextUser) {
        if (event === 'SIGNED_OUT' && !explicitSignOutRef.current && lastResolvedUserIdRef.current !== null) {
          // This SIGNED_OUT came from a failed token refresh (429), NOT from user clicking "Salir"
          console.log('[Auth] Ignoring SIGNED_OUT from failed token refresh (have active profile)');
          return;
        }
        explicitSignOutRef.current = false;
        resetAuthState();
        return;
      }

      setSession(nextSession);
      setUser(nextUser);

      // Already resolved this user's profile — skip refetch
      const alreadyResolved =
        lastResolvedUserIdRef.current === nextUser.id && profileRef.current !== null;

      if (event === 'TOKEN_REFRESHED' && alreadyResolved) {
        setLoading(false);
        return;
      }

      // Another fetch for this user is already in flight — skip
      if (inFlightUserIdRef.current === nextUser.id) {
        return;
      }

      // Already have this user's profile — skip
      if (alreadyResolved) {
        setLoading(false);
        return;
      }

      // Start fetching profile
      inFlightUserIdRef.current = nextUser.id;
      setLoading(true);

      try {
        const userProfile = await authService.getUserProfile(nextUser.id);

        if (!mounted) return;

        setProfile(userProfile);
        lastResolvedUserIdRef.current = nextUser.id;
      } catch (error) {
        console.error('[Auth] Error fetching profile:', error);
        if (mounted) {
          setProfile(null);
        }
      } finally {
        if (mounted) {
          inFlightUserIdRef.current = null;
          setLoading(false);
        }
      }
    };

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      void syncSession(nextSession, event);
    });

    // Check existing session
    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        void syncSession(currentSession, 'INITIAL_SESSION');
      })
      .catch((error) => {
        console.error('[Auth] Session check failed:', error);
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    explicitSignOutRef.current = true;
    lastResolvedUserIdRef.current = null;
    inFlightUserIdRef.current = null;
    return await authService.signOut();
  };

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      signIn,
      signOut,
    }),
    [user, session, profile, loading]
  );

  return createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};