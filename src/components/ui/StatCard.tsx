import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

const VALUE_TONES = {
  default: "text-white",
  amber: "text-amber-300",
  emerald: "text-emerald-300",
  rose: "text-rose-300",
  sky: "text-sky-300",
  violet: "text-violet-300",
} as const;

const ICON_TONES = {
  default: "border-white/10 bg-white/[0.04] text-zinc-300",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-300",
  sky: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-300",
} as const;

export type StatTone = keyof typeof VALUE_TONES;

/** Indicador numérico: etiqueta, valor y una línea de contexto. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ElementType;
  tone?: StatTone;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("surface flex min-w-0 flex-col gap-2 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow leading-snug">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
              ICON_TONES[tone],
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className={cn("num truncate font-mono text-[22px] font-bold leading-none", VALUE_TONES[tone])}>
        {value}
      </div>
      {hint ? <p className="text-xs leading-snug text-zinc-500">{hint}</p> : null}
      {children}
    </div>
  );
}
