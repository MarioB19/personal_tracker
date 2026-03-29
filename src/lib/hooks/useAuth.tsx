"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface AuthContextType {
  user: any;
  loading: boolean;
  authenticated: boolean;
  signInWithCode: (code: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ACCESS_CODE = process.env.NEXT_PUBLIC_ACCESS_CODE || "1234";
const AUTH_KEY = "lt_authenticated";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Single user system: check local storage for passcode clearance
    const isAuth = typeof window !== "undefined" && localStorage.getItem(AUTH_KEY) === "true";
    setAuthenticated(isAuth);
    setLoading(false);
  }, []);

  const signInWithCode = async (code: string): Promise<boolean> => {
    if (code !== ACCESS_CODE) return false;
    localStorage.setItem(AUTH_KEY, "true");
    setAuthenticated(true);
    return true;
  };

  const signOut = async () => {
    localStorage.removeItem(AUTH_KEY);
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
