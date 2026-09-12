import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import type { UserProfile } from '../lib/types';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  register: (data: { full_name: string; email: string; password: string; aadhaar?: string }) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user_profiles row after session changes
  const fetchProfile = async (userId: string) => {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data, error } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
      if (error) {
        console.warn('[auth] profile fetch failed:', error.message);
        return null;
      }
      return data as UserProfile;
    } catch (e) {
      console.warn('[auth] profile fetch error', e);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!isSupabaseConfigured()) {
        // Deferred keys — no live auth, mark not loading so Protected redirects to /login as expected
        if (mounted) setLoading(false);
        return;
      }
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const p = await fetchProfile(s.user.id);
        if (mounted) setProfile(p);
      }
      setLoading(false);
    };
    init();

    if (!isSupabaseConfigured()) return;

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        const p = await fetchProfile(newSession.user.id);
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) return { error: 'Supabase not configured — fill .env (VITE_SUPABASE_URL / ANON_KEY) and restart.' };
    const sanitizedEmail = email.trim().toLowerCase();
    if (!sanitizedEmail || !password) return { error: 'Email and password required' };
    const { error } = await supabase.auth.signInWithPassword({ email: sanitizedEmail, password });
    if (error) return { error: error.message };
    return {};
  };

  const logout = async () => {
    if (!isSupabaseConfigured()) {
      setUser(null);
      setSession(null);
      setProfile(null);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const register = async (data: { full_name: string; email: string; password: string; aadhaar?: string }) => {
    if (!isSupabaseConfigured()) return { error: 'Supabase not configured — fill .env and restart.' };
    const { full_name, email, password, aadhaar } = data;
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedName = full_name.trim();
    if (!sanitizedName || !sanitizedEmail || !password) return { error: 'All fields required' };
    // Role is always 'citizen' — the handle_new_user() DB trigger creates the profile row.
    // Staff roles are assigned via scripts/set-role.mjs (service key), never client-side.
    const meta: Record<string, string> = { full_name: sanitizedName, role: 'citizen' };
    if (aadhaar) meta.aadhaar = aadhaar.trim();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: sanitizedEmail,
      password,
      options: { data: meta },
    });
    if (authError) return { error: authError.message };
    if (!authData.user) return { error: 'Registration failed — no user returned' };
    return {};
  };

  const value: AuthContextType = { user, session, profile, loading, login, logout, register };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
