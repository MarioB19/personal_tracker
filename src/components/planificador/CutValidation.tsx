import { AlertTriangle, CheckCircle2, CircleHelp, ClipboardCheck, XCircle } from "lucide-react";
import type { CutCheckResult } from "@/lib/planning/savings-plan";
import type { FinancialCut } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

const STATUS_META = {
  OK: { label: "Cuadra", icon: CheckCircle2, className: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" },
  MISMATCH: { label: "Diferencia", icon: XCircle, className: "text-rose-300 bg-rose-500/10 border-rose-500/20" },
  WARNING: { label: "Revisar", icon: AlertTriangle, className: "text-amber-300 bg-amber-500/10 border-amber-500/20" },
  MISSING: { label: "Sin partidas", icon: CircleHelp, className: "text-zinc-300 bg-white/[0.05] border-white/10" },
} as const;

function signed(value: number) {
  if (Math.abs(value) < 1) return "—";
  return `${value > 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`;
}

/** Recalcula cada total declarado en el corte a partir de sus partidas. */
export function CutValidation({ cut, results }: { cut: FinancialCut; results: CutCheckResult[] }) {
  const counts = results.reduce(
    (acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <section id="validacion-corte" className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300">
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-zinc-100">Validación del corte</h2>
            <p className="text-xs text-zinc-500">
              {cut.label}: cada total que escribiste, recalculado con sus partidas
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {(["OK", "MISMATCH", "WARNING", "MISSING"] as const)
            .filter((status) => counts[status])
            .map((status) => (
              <span key={status} className={cn("rounded-full border px-2.5 py-1", STATUS_META[status].className)}>
                {counts[status]} {STATUS_META[status].label.toLowerCase()}
              </span>
            ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <th scope="col" className="px-5 py-2.5">Concepto</th>
              <th scope="col" className="px-3 py-2.5 text-right">Escrito</th>
              <th scope="col" className="px-3 py-2.5 text-right">Calculado</th>
              <th scope="col" className="px-3 py-2.5 text-right">Diferencia</th>
              <th scope="col" className="px-5 py-2.5 text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {results.map((item) => {
              const meta = STATUS_META[item.status];
              const Icon = meta.icon;
              return (
                <tr key={item.id} className="border-t border-white/[0.04] align-top">
                  <td className="px-5 py-2.5 text-zinc-200">
                    {item.label}
                    {item.note ? <p className="mt-0.5 text-xs text-zinc-500">{item.note}</p> : null}
                  </td>
                  <td className="num px-3 py-2.5 text-right font-mono text-zinc-400">{formatCurrency(item.declared)}</td>
                  <td className="num px-3 py-2.5 text-right font-mono font-semibold text-zinc-100">{formatCurrency(item.computed)}</td>
                  <td
                    className={cn(
                      "num px-3 py-2.5 text-right font-mono font-semibold",
                      item.status === "OK" ? "text-zinc-500" : item.difference < 0 ? "text-rose-300" : "text-amber-300",
                    )}
                  >
                    {signed(item.difference)}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", meta.className)}>
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {meta.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {cut.notes.length > 0 ? (
        <div className="border-t border-white/[0.05] px-5 py-3.5">
          <p className="eyebrow mb-2">Pendientes del corte</p>
          <ul className="space-y-1 text-sm text-zinc-300">
            {cut.notes.map((note) => (
              <li key={note} className="flex gap-2">
                <span className="text-amber-400" aria-hidden="true">•</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
