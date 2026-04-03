import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../lib/api';

export type User = {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  is_premium: boolean;
  plan: string;
  body_age?: number | null;
  body_weight?: number | null;
  body_height?: number | null;
  body_sex?: string | null;
  usage?: { used: number; limit: number; remaining: number };
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isPremium: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('kyroo_token');
      if (!token) { setUser(null); setLoading(false); return; }
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data ?? null);
      } else {
        await AsyncStorage.removeItem('kyroo_token');
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    await AsyncStorage.setItem('kyroo_token', data.token);
    setUser(data.user);
    return data.user as User;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string): Promise<void> => {
    const res = await apiFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    // No token issued — user must verify email first
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem('kyroo_token');
    setUser(null);
  }, []);

  const isPremium = user
    ? (user.is_admin || user.is_premium || user.plan === 'pro' || user.plan === 'basic')
    : false;

  return (
    <AuthContext.Provider value={{ user, loading, isPremium, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
