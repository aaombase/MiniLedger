import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getApiClient, setUnauthorizedHandler } from "@/api/client";
import { secureStorage } from "@/platform/secureStorage";
import { useToast } from "@/components/ToastProvider";
import type { User } from "@/shared/types";

import { AuthContext as Ctx, type AuthCtx, type AuthStatus as Status } from "./AuthContext";

const TOKEN_KEY = "miniledger.token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const expiring = useRef(false);

  const clear = useCallback(async () => {
    getApiClient().setToken(null);
    await secureStorage.deleteItem(TOKEN_KEY);
    qc.clear();
    setUser(null);
    setStatus("signedOut");
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (expiring.current) return;
      expiring.current = true;
      void clear().then(() => {
        toast.show({ message: "Your session expired. Please log in again.", tone: "error" });
        expiring.current = false;
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [clear, toast]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const token = await secureStorage.getItem(TOKEN_KEY);
      if (!token) { if (alive) setStatus("signedOut"); return; }
      getApiClient().setToken(token);
      try {
        const me = await getApiClient().me();
        if (alive) { setUser(me); setStatus("signedIn"); }
      } catch {
        if (alive) await clear();
      }
    })();
    return () => { alive = false; };
  }, [clear]);

  const signIn = useCallback(async (token: string, u: User) => {
    await secureStorage.setItem(TOKEN_KEY, token);
    getApiClient().setToken(token);
    setUser(u);
    setStatus("signedIn");
  }, []);

  const signOut = useCallback(async () => {
    try { await getApiClient().logout(); } catch { /* ignore */ }
    await clear();
  }, [clear]);

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("AuthProvider missing");
  return c;
}
