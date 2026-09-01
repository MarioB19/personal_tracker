"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { Target, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signInWithCode } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const success = await signInWithCode(code);
      if (success) {
        const requestedPath = new URLSearchParams(window.location.search).get(
          "returnTo",
        );
        const returnTo =
          requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
            ? requestedPath
            : "/";
        router.push(returnTo);
      } else {
        setError("Código incorrecto");
        setCode("");
      }
    } catch {
      setError("Error al conectar");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 relative overflow-hidden bg-[#050505]">
      {/* Dynamic Backgrounds */}
      <div className="hero-glow" />
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-amber-500/10 rounded-full blur-[120px] mix-blend-screen animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-orange-600/10 rounded-full blur-[150px] mix-blend-screen" />

      <div className="w-full max-w-[360px] relative z-10 page-enter">
        {/* Logo Area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 mb-5 shadow-[0_0_40px_rgba(245,158,11,0.3)] will-change-transform" style={{ animation: "float 6s ease-in-out infinite" }}>
            <Target className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md">
            LIFE<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">TRACKER</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-3 font-medium tracking-wide uppercase">Sistema de Gestión Personal</p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-6 sm:p-8 rounded-[24px]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 text-center">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Código de Seguridad</label>
              <input
                type="password"
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(""); }}
                placeholder="• • • •"
                autoFocus
                required
                maxLength={128}
                className="input text-center tracking-[0.75em] font-mono text-xl py-4 !bg-black/40 rounded-xl"
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center font-medium slide-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-sm rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Desbloquear"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-zinc-600 mt-8 font-medium">
          Acceso restringido · v2.0
        </p>
      </div>
    </div>
  );
}
