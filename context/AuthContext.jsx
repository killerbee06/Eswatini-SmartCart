import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Bootstrap: detect existing session on startup ────────
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s?.access_token) {
        _syncBackendProfile(s.access_token)
          .then((profile) => { if (mounted) setUser(profile); })
          .catch(() => { if (mounted) setUser(null); })
          .finally(() => { if (mounted) setLoading(false); });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s);
        if (s?.access_token) {
          try {
            const profile = await _syncBackendProfile(s.access_token);
            setUser(profile);
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    );

    return () => { mounted = false; subscription?.unsubscribe(); };
  }, []);

  // ── Sync Supabase user with backend profile ──────────────
  const _syncBackendProfile = async (accessToken) => {
    const prev = localStorage.getItem('smartcart_session');
    localStorage.setItem('smartcart_session', JSON.stringify({ access_token: accessToken }));
    try {
      const res = await authAPI.me();
      return res.data;
    } finally {
      if (prev) localStorage.setItem('smartcart_session', prev);
      else localStorage.removeItem('smartcart_session');
    }
  };

  // ── Email/Password Login ─────────────────────────────────
  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  }, []);

  // ── Google OAuth Login ───────────────────────────────────
  const loginWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw new Error(error.message);
  }, []);

  // ── Register ─────────────────────────────────────────────
  const register = useCallback(async (email, password, full_name, phone, date_of_birth) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name } },
    });
    if (error) throw new Error(error.message);

    if (data.user) {
      const accessToken = data.session?.access_token;
      if (accessToken) {
        const prev = localStorage.getItem('smartcart_session');
        localStorage.setItem('smartcart_session', JSON.stringify({ access_token: accessToken }));
        try {
          await authAPI.register({
            email,
            password,
            full_name,
            phone: phone || undefined,
            date_of_birth: date_of_birth || undefined,
          });
        } catch {
          // Profile may already exist; non-fatal
        } finally {
          if (prev) localStorage.setItem('smartcart_session', prev);
          else localStorage.removeItem('smartcart_session');
        }
      }
    }

    return { user: data.user, session: data.session, needsVerification: !data.session };
  }, []);

  // ── Logout ───────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('smartcart_session');
    setUser(null);
    setSession(null);
  }, []);

  // ── Forgot password ──────────────────────────────────────
  const forgotPassword = useCallback(async (email) => {
    const redirectUrl = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) throw new Error(error.message);
  }, []);

  // ── Reset password ───────────────────────────────────────
  const resetPassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  }, []);

  // ── Refresh user profile ─────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.access_token) {
        const profile = await _syncBackendProfile(s.access_token);
        setUser(profile);
      }
    } catch {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      login,
      loginWithGoogle,
      register,
      logout,
      forgotPassword,
      resetPassword,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
