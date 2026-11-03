"use client";

import { ArrowRightToLine, Plus, Trash2 } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { MONTH_LABELS } from "@/components/planificador/constants";
import { MoneyInput } from "@/components/ui/MoneyInput";

export interface EditableLine {
  id: string;
  name: string;
  values: number[];
  notes?: string;
}

export interface LineOption {
  value: string;
  label: string;
}

/**
 * Tabla editable de una sección del plan: filas = conceptos, columnas = meses.
 * La primera columna queda fija para poder desplazarse en móvil.
 */
export function PlanLineTable<T extends EditableLine>({
  title,
  description,
  icon: Icon,
  accent,
  lines,
  visibleMonths,
  onChange,
  onAdd,
  onRemove,
  addLabel,
  emptyLabel,
  renderTag,
  moveOptions,
  onMove,
  valueTone = "text-zinc-200",
}: {
  title: string;
  description?: string;
  icon: ElementType;
  accent: string;
  lines: T[];
  visibleMonths: number[];
  onChange: (id: string, patch: Partial<T>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  addLabel: string;
  emptyLabel: string;
  renderTag?: (line: T) => ReactNode;
  moveOptions?: LineOption[];
  onMove?: (id: string, target: string) => void;
  valueTone?: string;
}) {
  const subtotalFor = (month: number) =>
    lines.reduce((acc, line) => acc + (line.values[month] ?? 0), 0);
  const lineTotal = (line: T) =>
    visibleMonths.reduce((acc, month) => acc + (line.values[month] ?? 0), 0);
  const sectionTotal = visibleMonths.reduce((acc, month) => acc + subtotalFor(month), 0);

  const setValue = (line: T, month: number, value: number) => {
    const values = [...line.values];
    values[month] = value;
    onChange(line.id, { values } as Partial<T>);
  };

  const repeatForward = (line: T) => {
    const first = visibleMonths[0] ?? 0;
    const seed = line.values[first] ?? 0;
    onChange(line.id, {
      values: line.values.map((value, index) => (index >= first ? seed : value)),
    } as Partial<T>);
  };

  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border", accent)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-zinc-100">{title}</h2>
            {description ? <p className="text-xs text-zinc-500">{description}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="num font-mono text-sm font-bold text-zinc-200">
            {formatCurrency(sectionTotal)}
          </span>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-amber-500/30 hover:text-amber-200"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {addLabel}
          </button>
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="px-5 py-6 text-sm text-zinc-500">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <th scope="col" className="sticky left-0 z-10 min-w-[190px] bg-[#0b0b0d] px-4 py-2.5 sm:min-w-[280px]">
                  Concepto
                </th>
                {visibleMonths.map((month) => (
                  <th key={month} scope="col" className="w-[104px] px-1 py-2.5 text-right">
                    {MONTH_LABELS[month]}
                  </th>
                ))}
                <th scope="col" className="w-[120px] px-4 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="group border-t border-white/[0.04] hover:bg-white/[0.015]">
                  <th scope="row" className="sticky left-0 z-10 bg-[#0b0b0d] px-3 py-1 font-normal group-hover:bg-[#0e0e10]">
                    <div className="flex items-center gap-1.5">
                      <input
                        value={line.name}
                        onChange={(event) => onChange(line.id, { name: event.target.value } as Partial<T>)}
                        aria-label="Nombre del concepto"
                        className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1.5 text-[13px] font-medium text-zinc-100 outline-none transition-colors hover:bg-white/[0.04] focus:bg-white/[0.06]"
                      />
                      {renderTag ? renderTag(line) : null}
                      {moveOptions && onMove ? (
                        <select
                          aria-label="Mover a otra sección"
                          value=""
                          onChange={(event) => event.target.value && onMove(line.id, event.target.value)}
                          className="w-6 shrink-0 cursor-pointer appearance-none rounded-md bg-transparent text-center text-xs text-zinc-500 opacity-60 outline-none hover:bg-white/[0.06] hover:opacity-100 focus:opacity-100"
                          title="Mover a otra sección"
                        >
                          <option value="">⇄</option>
                          {moveOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              Mover a {option.label}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => repeatForward(line)}
                        title={`Repetir ${MONTH_LABELS[visibleMonths[0] ?? 0]} en los meses siguientes`}
                        aria-label="Repetir el primer mes visible en los siguientes"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 opacity-60 transition hover:bg-white/[0.06] hover:text-amber-300 hover:opacity-100 focus:opacity-100"
                      >
                        <ArrowRightToLine className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(line.id)}
                        title="Quitar concepto"
                        aria-label={`Quitar ${line.name}`}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 opacity-60 transition hover:bg-rose-500/10 hover:text-rose-300 hover:opacity-100 focus:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </th>
                  {visibleMonths.map((month) => (
                    <td key={month} className="px-1 py-1">
                      <MoneyInput
                        value={line.values[month] ?? 0}
                        onChange={(value) => setValue(line, month, value)}
                        ariaLabel={`${line.name} — ${MONTH_LABELS[month]}`}
                        className={valueTone}
                      />
                    </td>
                  ))}
                  <td className="num px-4 py-1 text-right font-mono text-[13px] font-semibold text-zinc-300">
                    {formatCurrency(lineTotal(line))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/[0.08] bg-white/[0.02] text-[13px] font-bold text-zinc-200">
                <th scope="row" className="sticky left-0 z-10 bg-[#0f0f11] px-4 py-2.5 text-left">
                  Subtotal
                </th>
                {visibleMonths.map((month) => (
                  <td key={month} className="num px-2 py-2.5 text-right font-mono">
                    {formatCurrency(subtotalFor(month))}
                  </td>
                ))}
                <td className="num px-4 py-2.5 text-right font-mono">{formatCurrency(sectionTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
