import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { BusinessInfo, Me } from './types';

interface AuthCtx {
  me: Me;
  loading: boolean;
  refresh: () => Promise<Me>;
  setBusiness: (b: BusinessInfo) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>({ user: null });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<Me>('/auth/me');
      setMe(data);
      return data;
    } catch {
      const empty = { user: null };
      setMe(empty);
      return empty;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setMe({ user: null });
  }, []);

  const setBusiness = useCallback((b: BusinessInfo) => setMe((m) => ({ ...m, business: b })), []);

  const value = useMemo(() => ({ me, loading, refresh, logout, setBusiness }), [me, loading, refresh, logout, setBusiness]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
