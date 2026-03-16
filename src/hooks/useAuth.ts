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
  // Timestamp of last successful auth to protect against spurious SIGNED_OUT
  const lastAuthSuccessRef = useRef<number>(0);
  // Flag to track intentional sign-out
  const intentionalSignOutRef = useRef(false);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    let mounted = true;

    const resetAuthState = () => {
      lastResolvedUserIdRef.current = null;
      inFlightUserIdRef.current = null;
      setProfile(null);
      setUser(null);
      setSession(null);
      setLoading(false);
    };

    const syncSession = (nextSession: Session | null, event?: string) => {
      if (!mounted) return;

      const nextUser = nextSession?.user ?? null;

      // Handle SIGNED_OUT: only respect if intentional or enough time has passed
      if (event === 'SIGNED_OUT') {
        if (intentionalSignOutRef.current) {
          intentionalSignOutRef.current = false;
          resetAuthState();
          return;
        }
        // If we authenticated less than 10 seconds ago, ignore spurious SIGNED_OUT
        // (caused by cascading token refresh 429 errors)
        const timeSinceAuth = Date.now() - lastAuthSuccessRef.current;
        if (timeSinceAuth < 10000 && lastResolvedUserIdRef.current) {
          console.warn('[Auth] Ignoring spurious SIGNED_OUT event (recent auth:', timeSinceAuth, 'ms ago)');
          return;
        }
        resetAuthState();
        return;
      }

      if (!nextUser) {
        if (!nextSession) {
          resetAuthState();
        }
        return;
      }

      // Update session/user immediately
      setSession(nextSession);
      setUser(nextUser);

      const alreadyResolvedCurrentUser =
        lastResolvedUserIdRef.current === nextUser.id && profileRef.current !== null;

      // For TOKEN_REFRESHED, just update session, don't re-fetch profile
      if (event === 'TOKEN_REFRESHED') {
        if (alreadyResolvedCurrentUser) {
          setLoading(false);
        }
        return;
      }

      // Skip if already in-flight for this user
      if (inFlightUserIdRef.current === nextUser.id) {
        return;
      }

      // Skip if already resolved
      if (alreadyResolvedCurrentUser) {
        setLoading(false);
        return;
      }

      // Fetch profile
      inFlightUserIdRef.current = nextUser.id;
      setLoading(true);

      authService.getUserProfile(nextUser.id, nextUser)
        .then((userProfile) => {
          if (!mounted) return;
          setProfile(userProfile);
          lastResolvedUserIdRef.current = nextUser.id;
          lastAuthSuccessRef.current = Date.now();
        })
        .catch((error) => {
          console.error('Error fetching profile:', error);
          if (mounted) {
            // Don't null out profile on error - use fallback
            const fallback = authService.buildFallbackProfileFromUser(nextUser);
            setProfile(fallback);
            lastResolvedUserIdRef.current = nextUser.id;
            lastAuthSuccessRef.current = Date.now();
          }
        })
        .finally(() => {
          if (mounted) {
            inFlightUserIdRef.current = null;
            setLoading(false);
          }
        });
    };

    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      syncSession(nextSession, event);
    });

    // Then check existing session
    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (mounted) {
          syncSession(currentSession, 'INITIAL_SESSION');
        }
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
    // Reset state for fresh login
    lastResolvedUserIdRef.current = null;
    inFlightUserIdRef.current = null;
    lastAuthSuccessRef.current = Date.now();
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    intentionalSignOutRef.current = true;
    lastResolvedUserIdRef.current = null;
    inFlightUserIdRef.current = null;
    lastAuthSuccessRef.current = 0;
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
