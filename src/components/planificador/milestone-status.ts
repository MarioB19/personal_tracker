import type { MilestoneProgress } from "@/lib/planning/savings-plan";
import { formatCurrency } from "@/lib/utils";
import { MONTH_LABELS, MONTH_NAMES } from "@/components/planificador/constants";

const STATUS = {
  REACHED: { label: "Alcanzado", chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300", bar: "bg-emerald-400" },
  ON_TRACK: { label: "En camino", chip: "border-sky-500/25 bg-sky-500/10 text-sky-300", bar: "bg-sky-400" },
  BEHIND: { label: "No alcanza", chip: "border-amber-500/25 bg-amber-500/10 text-amber-300", bar: "bg-amber-400" },
  MISSED: { label: "No se alcanzó", chip: "border-rose-500/25 bg-rose-500/10 text-rose-300", bar: "bg-rose-400" },
} as const;

/** Etiqueta, colores y frase corta para mostrar el avance automático de un hito. */
export function describeMilestone(item: MilestoneProgress, endMonth: number) {
  const status = STATUS[item.status];
  const today =
    item.current === null || item.asOfMonth === null
      ? "Aún sin datos reales"
      : `Llevas ${formatCurrency(item.current)} a ${MONTH_NAMES[item.asOfMonth]}`;
  const outlook =
    item.status === "REACHED" || item.status === "MISSED"
      ? `meta ${formatCurrency(item.target)} en ${MONTH_LABELS[endMonth]}`
      : `con el plan llegas a ${formatCurrency(item.projected)} en ${MONTH_LABELS[endMonth]}`;
  return { ...status, detail: `${today} · ${outlook}` };
}
