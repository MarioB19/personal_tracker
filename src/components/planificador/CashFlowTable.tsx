"use client";

import { Activity } from "lucide-react";
import type { PlanMonth } from "@/lib/planning/savings-plan";
import { cn, formatCurrency } from "@/lib/utils";
import { MONTH_LABELS } from "@/components/planificador/constants";
import { MoneyInput } from "@/components/ui/MoneyInput";

type RowKey = "income" | "spend" | "net" | "reserved" | "free" | "accumulated";

const ROWS: { key: RowKey; label: string; hint: string; strong?: boolean }[] = [
  { key: "income", label: "Ingresos", hint: "Todo lo que entra" },
  { key: "spend", label: "Gastos", hint: "Personal + negocio + puntual + deuda" },
  { key: "net", label: "Neto", hint: "Ingresos − gastos" },
  { key: "reserved", label: "Apartado", hint: "Fondos de ahorro del mes" },
  { key: "free", label: "Libre", hint: "Neto − apartado", strong: true },
  { key: "accumulated", label: "Dinero total", hint: "Saldo proyectado al cierre", strong: true },
];

function tone(key: RowKey, value: number) {
  if (key === "income") return "text-emerald-300";
  if (key === "spend") return "text-rose-300";
  if (key === "reserved") return "text-sky-300";
  if (key === "accumulated") return value < 0 ? "text-rose-300" : "text-amber-300";
  return value < 0 ? "text-rose-300" : "text-emerald-300";
}

/** Resumen del flujo mensual y registro del ahorro real. */
export function CashFlowTable({
  months,
  visibleMonths,
  actualSavings,
  onActualChange,
  anchorMonth,
}: {
  months: PlanMonth[];
  visibleMonths: number[];
  actualSavings: number[];
  onActualChange: (month: number, value: number) => void;
  anchorMonth: number | null;
}) {
  const total = (key: RowKey) =>
    key === "accumulated"
      ? months[visibleMonths[visibleMonths.length - 1] ?? 11]?.accumulated ?? 0
      : visibleMonths.reduce((acc, month) => acc + months[month][key], 0);

  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-3.5 sm:px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300">
          <Activity className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-zinc-100">Flujo mensual</h2>
          <p className="text-xs text-zinc-500">
            {anchorMonth !== null
              ? `Desde ${MONTH_LABELS[anchorMonth]} parte del saldo real del corte`
              : "Parte del saldo inicial del año"}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <th scope="col" className="sticky left-0 z-10 min-w-[200px] bg-[#0b0b0d] px-4 py-2.5 sm:min-w-[280px]">
                Concepto
              </th>
              {visibleMonths.map((month) => (
                <th key={month} scope="col" className={cn("w-[104px] px-2 py-2.5 text-right", month === anchorMonth && "text-amber-300")}>
                  {MONTH_LABELS[month]}
                  {month === anchorMonth ? " · corte" : ""}
                </th>
              ))}
              <th scope="col" className="w-[120px] px-4 py-2.5 text-right">Periodo</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className={cn("border-t border-white/[0.04]", row.strong && "bg-white/[0.015]")}>
                <th scope="row" className={cn("sticky left-0 z-10 px-4 py-2.5 text-left font-normal", row.strong ? "bg-[#0e0e10]" : "bg-[#0b0b0d]")}>
                  <span className={cn("text-[13px] text-zinc-100", row.strong ? "font-bold" : "font-medium")}>{row.label}</span>
                  <span className="ml-2 hidden text-xs text-zinc-500 sm:inline">{row.hint}</span>
                </th>
                {visibleMonths.map((month) => {
                  const value = months[month][row.key];
                  return (
                    <td key={month} className={cn("num px-2 py-2.5 text-right font-mono text-[13px]", row.strong && "font-bold", tone(row.key, value))}>
                      {formatCurrency(value)}
                    </td>
                  );
                })}
                <td className={cn("num px-4 py-2.5 text-right font-mono text-[13px] font-bold", tone(row.key, total(row.key)))}>
                  {formatCurrency(total(row.key))}
                </td>
              </tr>
            ))}
            <tr className="border-t border-white/[0.08]">
              <th scope="row" className="sticky left-0 z-10 bg-[#0b0b0d] px-4 py-1.5 text-left font-normal">
                <span className="text-[13px] font-medium text-zinc-100">Ahorro real</span>
                <span className="ml-2 hidden text-xs text-zinc-500 sm:inline">Lo que de verdad ahorraste</span>
              </th>
              {visibleMonths.map((month) => (
                <td key={month} className="px-1 py-1">
                  <MoneyInput
                    value={actualSavings[month] ?? 0}
                    onChange={(value) => onActualChange(month, value)}
                    ariaLabel={`Ahorro real ${MONTH_LABELS[month]}`}
                    className="text-sky-200"
                  />
                </td>
              ))}
              <td className="num px-4 py-1.5 text-right font-mono text-[13px] font-semibold text-sky-200">
                {formatCurrency(visibleMonths.reduce((acc, month) => acc + (actualSavings[month] ?? 0), 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
