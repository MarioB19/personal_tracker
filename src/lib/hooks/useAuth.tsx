"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface AuthContextType {
  user: { uid: string; name: string } | null;
  loading: boolean;
  authenticated: boolean;
  signInWithCode: (code: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const body = (await response.json()) as { authenticated?: boolean };
        return body.authenticated === true;
      })
      .then(setAuthenticated)
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAuthenticated(false);
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const signInWithCode = async (code: string): Promise<boolean> => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) return false;
    setAuthenticated(true);
    return true;
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    setAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      user: authenticated ? { uid: "brandon", name: "Brandon" } : null,
      loading,
      authenticated,
      signInWithCode,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}

// Single-user hardcoded UID
export function useUid(): string | null {
  const { authenticated } = useAuth();
  return authenticated ? "brandon" : null;
}
