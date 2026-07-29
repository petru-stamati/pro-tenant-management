"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiFetch, setAccessToken, refreshAccessToken } from "./api-client";
import type { AuthUser } from "./types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Sets a lightweight, non-httpOnly cookie carrying just the role — read only
 * by proxy.ts for optimistic "which section am I in" redirects (Next.js
 * auth guide's "optimistic checks" pattern). It is never treated as a
 * credential: every real authorization decision happens server-side against
 * the actual access token, exactly as designed in the backend's Phase 4 doc.
 */
function setRoleCookie(role: string | null) {
  if (role) {
    document.cookie = `pt_role=${role}; path=/; samesite=lax; max-age=${30 * 24 * 60 * 60}`;
  } else {
    document.cookie = "pt_role=; path=/; max-age=0";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    (async () => {
      const token = await refreshAccessToken();
      if (!token) {
        // Stale pt_role cookie from a previous session would otherwise make
        // proxy.ts keep bouncing us back into the app, fighting the
        // client-side redirect to /login below (infinite loop).
        setRoleCookie(null);
        setStatus("unauthenticated");
        return;
      }
      setAccessToken(token);
      try {
        const me = await apiFetch<AuthUser>("/auth/me");
        setUser(me);
        setRoleCookie(me.role);
        setStatus("authenticated");
      } catch {
        setRoleCookie(null);
        setStatus("unauthenticated");
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ accessToken: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipAuthRetry: true,
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    setRoleCookie(data.user.role);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    setAccessToken(null);
    setUser(null);
    setRoleCookie(null);
    setStatus("unauthenticated");
  }, []);

  return <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
