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
  const profileRef = useRef<UserProfile | null>(null);
  const lastResolvedUserIdRef = useRef<string | null>(null);
  const inFlightUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    let mounted = true;

    const resetAuthState = () => {
      lastResolvedUserIdRef.current = null;
      inFlightUserIdRef.current = null;
      setProfile(null);
      setLoading(false);
    };

    const syncSession = async (nextSession: Session | null, event?: string) => {
      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      const nextUser = nextSession?.user ?? null;

      if (!nextUser) {
        resetAuthState();
        return;
      }

      const alreadyResolvedCurrentUser =
        lastResolvedUserIdRef.current === nextUser.id && profileRef.current !== null;

      if (event === 'TOKEN_REFRESHED' && alreadyResolvedCurrentUser) {
        setLoading(false);
        return;
      }

      if (inFlightUserIdRef.current === nextUser.id) {
        return;
      }

      if (alreadyResolvedCurrentUser) {
        setLoading(false);
        return;
      }

      inFlightUserIdRef.current = nextUser.id;
      setLoading(true);

      try {
        const userProfile = await authService.getUserProfile(nextUser.id, nextUser);

        if (!mounted) return;

        setProfile(userProfile);
        lastResolvedUserIdRef.current = nextUser.id;
      } catch (error) {
        console.error('Error fetching profile:', error);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      void syncSession(nextSession, event);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        void syncSession(currentSession, 'INITIAL_SESSION');
      })
      .catch((error) => {
        console.error('Session check failed:', error);
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
