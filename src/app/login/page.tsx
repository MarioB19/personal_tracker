"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { Loader2, LockKeyhole } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { BRAND_ASSETS } from "@/components/brand/assets";
import { AppBackdrop } from "@/components/brand/AppBackdrop";

/** Inclinación 3D sutil del render según el puntero (solo puntero fino y con movimiento permitido). */
function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const canTilt =
      window.matchMedia("(pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canTilt) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = event.clientX / window.innerWidth - 0.5;
        const y = event.clientY / window.innerHeight - 0.5;
        node.style.setProperty("--tilt-x", `${(-y * 10).toFixed(2)}deg`);
        node.style.setProperty("--tilt-y", `${(x * 14).toFixed(2)}deg`);
        node.style.setProperty("--shift-x", `${(x * 18).toFixed(1)}px`);
        node.style.setProperty("--shift-y", `${(y * 14).toFixed(1)}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);
  return ref;
}

function HeroSculpture() {
  const tiltRef = useTilt<HTMLDivElement>();
  const hero = BRAND_ASSETS.loginHero;

  return (
    <div ref={tiltRef} className="login-hero" aria-hidden="true">
      <div className="login-hero__halo" />
      <div className="login-hero__orbit login-hero__orbit--a" />
      <div className="login-hero__orbit login-hero__orbit--b" />
      <div className="login-hero__float">
        {hero ? (
          <Image
            className="login-hero__art"
            src={hero.src}
            width={hero.width}
            height={hero.height}
            alt=""
            loading="eager"
            fetchPriority="high"
            sizes="(min-width: 1024px) 520px, 220px"
          />
        ) : (
          <div className="login-hero__core" />
        )}
      </div>
      <div className="login-hero__floor" />
    </div>
  );
}

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
        setError("Código incorrecto. Revísalo e inténtalo de nuevo.");
        setCode("");
      }
    } catch {
      setError("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
    }
    setLoading(false);
  };

  return (
    <main className="login-shell">
      <AppBackdrop />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1180px] items-center gap-6 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-12">
        {/* Formulario */}
        <section className="order-2 w-full max-w-[420px] justify-self-center page-enter lg:order-1 lg:justify-self-start">
          <div className="mb-8 flex items-center gap-3">
            <BrandMark size={44} priority />
            <div className="flex flex-col">
              <span className="font-display text-base font-bold tracking-tight text-white">
                LifeTracker
              </span>
              <span className="text-xs text-zinc-500">Personal OS</span>
            </div>
          </div>

          <h1 className="text-[32px] font-bold leading-[1.1] text-white sm:text-[40px]">
            Tu día, tu dinero y tus metas en un solo lugar.
          </h1>
          <p className="mt-3 max-w-[38ch] text-[15px] leading-relaxed text-zinc-400">
            Ingresa tu código de acceso para abrir tu tablero.
          </p>

          <form
            onSubmit={handleSubmit}
            className="surface mt-8 space-y-5 p-5 sm:p-6"
            noValidate
            aria-busy={loading}
          >
            <div className="space-y-2">
              <label
                htmlFor="access-code"
                className="flex items-center gap-2 text-sm font-semibold text-zinc-200"
              >
                <LockKeyhole className="h-4 w-4 text-amber-300" aria-hidden="true" />
                Código de acceso
              </label>
              <input
                id="access-code"
                name="access-code"
                type="password"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError("");
                }}
                placeholder="••••"
                autoFocus
                autoComplete="current-password"
                required
                maxLength={128}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "access-code-error" : undefined}
                className="input !min-h-[52px] !rounded-xl !bg-black/45 text-center font-mono text-xl tracking-[0.6em]"
              />
            </div>

            <div aria-live="assertive">
              {error ? (
                <p
                  id="access-code-error"
                  role="alert"
                  className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200 slide-in"
                >
                  {error}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="btn-primary w-full !min-h-[50px] !rounded-xl text-[15px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  <span>Verificando…</span>
                </>
              ) : (
                "Desbloquear"
              )}
            </button>
          </form>

          <p className="mt-6 text-xs text-zinc-500">
            Acceso privado y restringido a tu cuenta.
          </p>
        </section>

        {/* Render 3D */}
        <div className="order-1 flex justify-center lg:order-2">
          <HeroSculpture />
        </div>
      </div>
    </main>
  );
}
