"use client";

import { Flag, Plus, Trash2 } from "lucide-react";
import type { MilestoneProgress } from "@/lib/planning/savings-plan";
import type { PlanMilestone } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MONTH_LABELS } from "@/components/planificador/constants";
import { describeMilestone } from "@/components/planificador/milestone-status";
import { MoneyInput } from "@/components/ui/MoneyInput";

/** Hitos de ahorro: el avance se calcula solo con tu dinero real y la proyección del plan. */
export function MilestonesPanel({
  milestones,
  progress,
  excludedLabel,
  onChange,
  onAdd,
  onRemove,
}: {
  milestones: PlanMilestone[];
  progress: MilestoneProgress[];
  /** Apartado con destino que no cuenta para las metas (p. ej. el fondo del coche). */
  excludedLabel?: string;
  onChange: (id: string, patch: Partial<PlanMilestone>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300">
            <Flag className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-zinc-100">Hitos</h2>
            <p className="text-xs text-zinc-500">
              El avance se calcula solo con tu ahorro real{excludedLabel ? `, sin contar ${excludedLabel}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-amber-500/30 hover:text-amber-200"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Hito
        </button>
      </div>
      {milestones.length === 0 ? (
        <p className="px-5 py-6 text-sm text-zinc-500">Sin hitos para este año.</p>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {milestones.map((milestone) => {
            const item = progress.find((entry) => entry.id === milestone.id);
            const view = item ? describeMilestone(item, milestone.endMonth) : null;
            return (
              <li key={milestone.id} className="grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_150px_200px_auto] sm:items-center sm:px-5">
                <div className="min-w-0">
                  <input
                    value={milestone.name}
                    onChange={(event) => onChange(milestone.id, { name: event.target.value })}
                    aria-label="Nombre del hito"
                    className="w-full rounded-md bg-transparent px-1.5 py-1 text-sm font-semibold text-zinc-100 outline-none hover:bg-white/[0.04] focus:bg-white/[0.06]"
                  />
                  {item && view ? (
                    <>
                      <div className="mt-2 flex items-center gap-2 px-1.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <div className={cn("h-full rounded-full", view.bar)} style={{ width: `${item.percent}%` }} />
                        </div>
                        <span className="num w-9 text-right font-mono text-xs text-zinc-400">{item.percent}%</span>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", view.chip)}>{view.label}</span>
                      </div>
                      <p className="mt-1 px-1.5 text-xs text-zinc-500">{view.detail}</p>
                    </>
                  ) : null}
                </div>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Meta
                  <MoneyInput
                    variant="field"
                    value={milestone.amount}
                    onChange={(value) => onChange(milestone.id, { amount: value })}
                    ariaLabel={`Meta de ${milestone.name}`}
                    placeholder="0"
                  />
                </label>
                <div className="flex items-end gap-2 text-xs text-zinc-500">
                  <label className="flex flex-1 flex-col gap-1">
                    Desde
                    <select
                      value={milestone.startMonth}
                      onChange={(event) => onChange(milestone.id, { startMonth: Number(event.target.value) })}
                      className="h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-sm text-zinc-200"
                    >
                      {MONTH_LABELS.map((label, index) => (
                        <option key={label} value={index}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-1 flex-col gap-1">
                    Hasta
                    <select
                      value={milestone.endMonth}
                      onChange={(event) => onChange(milestone.id, { endMonth: Number(event.target.value) })}
                      className="h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-sm text-zinc-200"
                    >
                      {MONTH_LABELS.map((label, index) => (
                        <option key={label} value={index} disabled={index < milestone.startMonth}>{label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(milestone.id)}
                  aria-label={`Quitar ${milestone.name}`}
                  className="flex h-9 w-9 items-center justify-center justify-self-end rounded-lg text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
