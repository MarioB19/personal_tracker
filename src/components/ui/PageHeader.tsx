"use client";

import type { ElementType, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SectionArt, hasSectionArt } from "@/components/brand/SectionArt";

const TONES = {
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  violet: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  sky: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  rose: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  zinc: "border-white/10 bg-white/[0.04] text-zinc-300",
} as const;

export type PageTone = keyof typeof TONES;

/**
 * Ícono + título + subtítulo de una página. Si la sección tiene un render 3D
 * de marca, lo muestra en lugar del ícono plano.
 */
export function PageTitle({
  icon: Icon,
  title,
  subtitle,
  eyebrow,
  tone = "amber",
}: {
  icon: ElementType;
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  tone?: PageTone;
}) {
  const pathname = usePathname();
  const withArt = hasSectionArt(pathname);

  return (
    <div className="flex min-w-0 items-center gap-4">
      {withArt ? (
        <SectionArt />
      ) : (
        <div
          aria-hidden="true"
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
            TONES[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="text-[22px] font-bold leading-tight tracking-tight text-white sm:text-[26px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Contenedor del encabezado: en móvil las acciones bajan a su propia fila. */
export const PAGE_HEADER_CLASS =
  "mb-2 flex flex-col gap-4 pt-1 lg:flex-row lg:items-end lg:justify-between";

/**
 * Encabezado común de página: ícono, título, subtítulo y acciones.
 * En móvil las acciones bajan a su propia fila y pueden desplazarse.
 */
export function PageHeader({
  icon,
  title,
  subtitle,
  eyebrow,
  tone = "amber",
  actions,
  className,
}: {
  icon: ElementType;
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  tone?: PageTone;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn(PAGE_HEADER_CLASS, className)}>
      <PageTitle icon={icon} title={title} subtitle={subtitle} eyebrow={eyebrow} tone={tone} />
      {actions ? (
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
