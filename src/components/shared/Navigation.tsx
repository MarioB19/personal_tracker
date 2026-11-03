"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
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
import { useState } from "react";

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

function currentLabel(pathname: string) {
  return (
    ALL_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      ?.label ?? "LifeTracker"
  );
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
  const isActive =
    pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex min-h-[42px] items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors duration-150",
        isActive
          ? "bg-amber-500/10 text-amber-200 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.18)]"
          : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          isActive
            ? "bg-amber-500/15 text-amber-300"
            : "text-zinc-500 group-hover:text-zinc-200"
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </div>

      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarContent({
  pathname,
  onNavClick,
  mobile = false,
}: {
  pathname: string;
  onNavClick?: () => void;
  mobile?: boolean;
}) {
  const [signingOut, setSigningOut] = useState(false);

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
      {/* Header / Logo */}
      <div
        className={cn(
          "shrink-0 border-b border-white/[0.06]",
          mobile ? "h-16 px-4" : "h-[72px] px-5"
        )}
      >
        <div className="flex h-full items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_0_24px_rgba(245,158,11,0.22)]">
              <Target className="h-4 w-4 text-black" />
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-black tracking-tight text-white">
                LifeTracker
              </span>
              <span className="text-[11px] text-zinc-500">
                Personal OS
              </span>
            </div>
          </div>

          {mobile && (
            <button
              onClick={onNavClick}
              aria-label="Cerrar menú"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-zinc-400 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Secciones" className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, index) => (
          <div key={section.label} className={cn(index > 0 && "mt-5")}>
            <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
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
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/[0.06] px-3 py-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-500/20 bg-gradient-to-br from-amber-400/20 to-orange-500/20">
              <span className="text-[13px] font-bold text-amber-400">B</span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-zinc-200">
                Brandon
              </p>
              <p className="truncate text-[11px] text-zinc-500">Personal</p>
            </div>

            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-black/20 text-zinc-500 transition-colors hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-wait disabled:opacity-50"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
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

  return (
    <>
      {/* ═══════════════════════════════════════
         DESKTOP SIDEBAR
         Renders as a normal block element.
         The parent grid in layout.tsx controls its column.
         `sticky top-0 h-screen` keeps it visible on scroll.
      ═══════════════════════════════════════ */}
      <aside className="hidden lg:flex h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#080808]">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* ═══════════════════════════════════════
         MOBILE: Fixed top header bar
      ═══════════════════════════════════════ */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#080808]/95 px-4 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500">
            <Target className="h-4 w-4 text-black" />
          </div>

          <div className="flex flex-col">
            <span className="text-[14px] font-black tracking-tight text-white">
              {currentLabel(pathname)}
            </span>
            <span className="text-[11px] text-zinc-500">LifeTracker · Personal OS</span>
          </div>
        </div>

        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-zinc-400 transition-colors hover:text-white"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
      </header>

      {/* ═══════════════════════════════════════
         MOBILE: Slide-out drawer
      ═══════════════════════════════════════ */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />

          <aside className="fixed inset-y-0 left-0 z-50 flex w-[290px] flex-col border-r border-white/[0.06] bg-[#080808] shadow-2xl lg:hidden slide-in">
            <SidebarContent
              pathname={pathname}
              mobile
              onNavClick={() => setDrawerOpen(false)}
            />
          </aside>
        </>
      )}
    </>
  );
}
