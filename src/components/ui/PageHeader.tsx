import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  violet: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  sky: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  rose: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  zinc: "border-white/10 bg-white/[0.04] text-zinc-300",
} as const;

export type PageTone = keyof typeof TONES;

/** Ícono + título + subtítulo de una página. */
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
  return (
    <div className="flex min-w-0 items-start gap-3.5">
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
          TONES[tone],
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-white sm:text-2xl">
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
