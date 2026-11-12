"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  Wallet,
  Calendar,
  Swords,
  BarChart3,
  ClipboardCheck,
  Menu,
  X,
  Map,
  PiggyBank,
  LogOut,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useId, useRef, useState } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { useModalA11y } from "@/lib/hooks/useModalA11y";

const NAV_SECTIONS = [
  {
    label: "Hoy",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/agenda", label: "Agenda", icon: Calendar },
      { href: "/misiones", label: "Misiones", icon: Swords },
    ],
  },
  {
    label: "Dinero",
    items: [
      { href: "/finanzas", label: "Finanzas", icon: Wallet },
      { href: "/planificador", label: "Planificador", icon: PiggyBank },
    ],
  },
  {
    label: "Rumbo",
    items: [
      { href: "/estrategia/metas", label: "Metas", icon: Trophy },
      { href: "/hoja-de-ruta", label: "Hoja de ruta", icon: Map },
      { href: "/revisiones", label: "Revisiones", icon: ClipboardCheck },
      { href: "/analitica", label: "Analítica", icon: BarChart3 },
    ],
  },
];

const ALL_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function currentLabel(pathname: string) {
  return ALL_ITEMS.find((item) => isActivePath(pathname, item.href))?.label ?? "LifeTracker";
}

function NavItem({
  href,
  label,
  icon: Icon,
  pathname,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  pathname: string;
  onClick?: () => void;
}) {
  const isActive = isActivePath(pathname, href);

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "nav-link group flex min-h-[44px] items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors duration-150",
        isActive
          ? "bg-gradient-to-r from-amber-500/[0.14] to-amber-500/[0.04] text-amber-100 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.2),inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "text-zinc-400 hover:bg-white/[0.045] hover:text-white",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          isActive
            ? "bg-gradient-to-b from-amber-400/25 to-orange-500/10 text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            : "text-zinc-500 group-hover:text-zinc-200",
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>

      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarContent({
  pathname,
  onNavClick,
  onClose,
  closeButtonRef,
  mobile = false,
}: {
  pathname: string;
  onNavClick?: () => void;
  onClose?: () => void;
  closeButtonRef?: React.Ref<HTMLButtonElement>;
  mobile?: boolean;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const idPrefix = useId();

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  };

  return (
    <>
      {/* Marca */}
      <div
        className={cn(
          "shrink-0 border-b border-white/[0.06]",
          mobile ? "h-16 px-4" : "h-[76px] px-5",
        )}
      >
        <div className="flex h-full items-center justify-between">
          <Link
            href="/dashboard"
            onClick={onNavClick}
            className="flex items-center gap-3 rounded-xl"
            aria-label="LifeTracker, ir al Dashboard"
          >
            <BrandMark size={mobile ? 38 : 42} priority />
            <span className="flex flex-col">
              <span className="font-display text-[15px] font-bold tracking-tight text-white">
                LifeTracker
              </span>
              <span className="text-[11px] text-zinc-500">Personal OS</span>
            </span>
          </Link>

          {mobile && (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Cerrar menú"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-zinc-400 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Secciones */}
      <nav aria-label="Secciones" className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, index) => {
          const labelId = `${idPrefix}-${section.label}`;
          return (
            <div
              key={section.label}
              role="group"
              aria-labelledby={labelId}
              className={cn(index > 0 && "mt-5")}
            >
              <p
                id={labelId}
                className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500"
              >
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItem
                    key={item.href}
                    {...item}
                    pathname={pathname}
                    onClick={onNavClick}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Usuario */}
      <div className="shrink-0 border-t border-white/[0.06] px-3 py-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-500/25 bg-gradient-to-br from-amber-400/25 to-orange-500/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            >
              <span className="text-[13px] font-bold text-amber-300">B</span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-zinc-200">Brandon</p>
              <p className="truncate text-[11px] text-zinc-500">Personal</p>
            </div>

            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              aria-label={signingOut ? "Cerrando sesión" : "Cerrar sesión"}
              title="Cerrar sesión"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-black/20 text-zinc-400 transition-colors hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-wait disabled:opacity-50"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerId = useId();

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useModalA11y({
    open: drawerOpen,
    onClose: closeDrawer,
    containerRef: drawerRef,
    initialFocusRef: closeButtonRef,
    returnFocusRef: triggerRef,
  });

  // Cerrar el cajón al navegar (también con atrás/adelante del navegador).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setDrawerOpen(false);
  }

  return (
    <>
      {/* Escritorio: barra lateral fija */}
      <aside
        aria-label="Navegación principal"
        className="nav-dock hidden h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[22px] lg:sticky lg:top-4 lg:flex lg:self-start"
      >
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Móvil: barra superior */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#08080b]/85 px-4 backdrop-blur-xl lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark size={36} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-display text-[15px] font-bold tracking-tight text-white">
              {currentLabel(pathname)}
            </span>
            <span className="truncate text-[11px] text-zinc-500">LifeTracker · Personal OS</span>
          </div>
        </div>

        <button
          ref={triggerRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={drawerOpen}
          aria-controls={drawerId}
          aria-haspopup="dialog"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-zinc-300 transition-colors hover:text-white"
        >
          <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </header>

      {/* Móvil: cajón lateral (diálogo modal) */}
      {drawerOpen && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden fade-in"
            onClick={closeDrawer}
          />

          <aside
            ref={drawerRef}
            id={drawerId}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="nav-dock fixed inset-y-0 left-0 z-50 flex w-[min(300px,86vw)] flex-col rounded-r-[22px] shadow-2xl lg:hidden slide-in"
          >
            <SidebarContent
              pathname={pathname}
              mobile
              onNavClick={closeDrawer}
              onClose={closeDrawer}
              closeButtonRef={closeButtonRef}
            />
          </aside>
        </>
      )}
    </>
  );
}
