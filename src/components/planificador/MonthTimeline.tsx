"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MonthProgress, PlanMonth } from "@/lib/planning/savings-plan";
import { cn, formatCurrency } from "@/lib/utils";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { MONTH_NAMES } from "@/components/planificador/constants";

const STATUS = {
  DONE: { label: "", className: "" },
  MISSING: { label: "Sin registrar", className: "border-amber-500/25 bg-amber-500/10 text-amber-200" },
  EMPTY: { label: "", className: "" },
  CURRENT: { label: "En curso", className: "border-sky-500/25 bg-sky-500/10 text-sky-200" },
  FUTURE: { label: "Por venir", className: "border-white/10 bg-white/[0.04] text-zinc-400" },
} as const;

function signed(value: number) {
  if (value === 0) return formatCurrency(0);
  return `${value > 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`;
}

/**
 * Una fila por mes: ahorro planeado, ahorro real (editable) y diferencia.
 * Al tocar un mes se ve de dónde sale el plan (ingresos, gastos, apartado).
 */
export function MonthTimeline({
  progress,
  months,
  onRealChange,
}: {
  progress: MonthProgress[];
  months: PlanMonth[];
  onRealChange: (month: number, value: number) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.05] px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-bold text-zinc-100">Mes a mes</h2>
        <p className="text-xs text-zinc-500">Escribe lo que de verdad ahorraste cada mes</p>
      </div>
      <div className="hidden grid-cols-[minmax(0,1fr)_120px_150px_120px_24px] gap-3 px-5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:grid">
        <span>Mes</span>
        <span className="text-right">Plan</span>
        <span className="text-right">Real</span>
        <span className="text-right">Diferencia</span>
        <span />
      </div>
      <ul className="divide-y divide-white/[0.04]">
        {progress.map((item) => {
          const month = months[item.month];
          const status = STATUS[item.status];
          const expanded = open === item.month;
          return (
            <li key={item.month} className={cn(item.status === "CURRENT" && "bg-sky-500/[0.03]")}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_150px_120px_24px] sm:px-5">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : item.month)}
                  aria-expanded={expanded}
                  className="flex min-w-0 items-center gap-2 text-left"
                >
                  <span className="text-sm font-semibold capitalize text-zinc-100">{MONTH_NAMES[item.month]}</span>
                  {status.label ? (
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", status.className)}>{status.label}</span>
                  ) : null}
                </button>
                <div className="flex items-center justify-end gap-2 sm:hidden">
                  <span className="text-xs text-zinc-500">Plan</span>
                  <span className={cn("num font-mono text-sm", item.plan < 0 ? "text-rose-300" : "text-zinc-300")}>{formatCurrency(item.plan)}</span>
                </div>
                <span className={cn("num hidden text-right font-mono text-sm sm:block", item.plan < 0 ? "text-rose-300" : "text-zinc-300")}>
                  {formatCurrency(item.plan)}
                </span>
                <label className="flex min-w-0 items-center gap-3 sm:block">
                  <span className="text-xs text-zinc-500 sm:hidden">Real</span>
                  <MoneyInput
                    value={item.real ?? 0}
                    onChange={(value) => onRealChange(item.month, value)}
                    ariaLabel={`Ahorro real de ${MONTH_NAMES[item.month]}`}
                    className="h-9 w-32 border border-white/10 text-emerald-200 sm:w-full"
                  />
                </label>
                <span
                  className={cn(
                    "num text-right font-mono text-sm font-semibold",
                    item.difference === null || item.difference === 0
                      ? "text-zinc-500"
                      : item.difference > 0
                        ? "text-emerald-300"
                        : "text-rose-300",
                  )}
                >
                  {item.difference === null ? "—" : signed(item.difference)}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : item.month)}
                  aria-label={`${expanded ? "Ocultar" : "Ver"} detalle de ${MONTH_NAMES[item.month]}`}
                  className="hidden h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.06] sm:flex"
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
                </button>
              </div>
              {expanded ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-white/[0.04] bg-black/20 px-4 py-3 text-[13px] sm:grid-cols-4 sm:px-5">
                  {[
                    ["Ingresos", month.income, "text-emerald-300"],
                    ["Gastos", month.spend, "text-rose-300"],
                    ["Apartado", month.reserved, "text-sky-300"],
                    ["Libre", month.free, month.free < 0 ? "text-rose-300" : "text-zinc-100"],
                  ].map(([label, value, tone]) => (
                    <div key={String(label)} className="flex items-center justify-between gap-2">
                      <dt className="text-zinc-500">{label}</dt>
                      <dd className={cn("num font-mono", String(tone))}>{formatCurrency(Number(value))}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
