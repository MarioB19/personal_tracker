"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  CalendarRange,
  CreditCard,
  Flag,
  Landmark,
  Loader2,
  Pencil,
  PiggyBank,
  Receipt,
  RotateCcw,
  Save,
  ShoppingBag,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useUid } from "@/lib/hooks/useAuth";
import { monthInMexicoCity } from "@/lib/time/month";
import { cn, formatCurrency } from "@/lib/utils";
import {
  computeMilestoneProgress,
  computeMonthProgress,
  computePlanMonths,
  evaluateFinancialCut,
  EXPENSE_GROUPS,
  LEGACY_EXPENSE_LINE_ID,
  summarizePlanYear,
  summarizeProgress,
  type PlanDraft,
} from "@/lib/planning/savings-plan";
import {
  loadLatestFinancialCut,
  loadSavingsPlan,
  saveSavingsPlan,
  SavingsPlanConflictError,
} from "@/lib/repositories/savings-plans";
import type {
  FinancialContext,
  FinancialCut,
  IncomeSourcePlan,
  PlanExpenseGroup,
  PlanExpenseLine,
  PlanIncomeKind,
  PlanMilestone,
  PlanSavingsLine,
} from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatCard } from "@/components/ui/StatCard";
import { PlanLineTable } from "@/components/planificador/PlanLineTable";
import { ProgressChart } from "@/components/planificador/ProgressChart";
import { MonthTimeline } from "@/components/planificador/MonthTimeline";
import { Disclosure } from "@/components/ui/Disclosure";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { CutValidation } from "@/components/planificador/CutValidation";
import { MilestonesPanel } from "@/components/planificador/MilestonesPanel";
import { GROUP_META, MONTH_LABELS, MONTH_NAMES } from "@/components/planificador/constants";

const FIRST_PLAN_YEAR = 2026;
const GROUP_ICONS: Record<PlanExpenseGroup, typeof Wallet> = {
  PERSONAL: Receipt,
  BUSINESS: Briefcase,
  ONE_OFF: ShoppingBag,
  DEBT: CreditCard,
};
const ALL_MONTHS = Array.from({ length: 12 }, (_, index) => index);
const zeros = () => Array(12).fill(0) as number[];
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

type Range = "year" | "cut";

function ContextTag({
  context,
  onToggle,
}: {
  context: FinancialContext;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Cambiar entre personal y negocio"
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors",
        context === "BUSINESS"
          ? "border-violet-500/25 bg-violet-500/10 text-violet-200"
          : "border-white/10 bg-white/[0.04] text-zinc-300",
      )}
    >
      <span className="sm:hidden" aria-hidden="true">{context === "BUSINESS" ? "N" : "P"}</span>
      <span className="hidden sm:inline">{context === "BUSINESS" ? "Negocio" : "Personal"}</span>
      <span className="sr-only sm:hidden">{context === "BUSINESS" ? "Negocio" : "Personal"}</span>
    </button>
  );
}

const INCOME_KIND_LABEL: Record<PlanIncomeKind, string> = {
  RECURRING: "Fijo",
  EXTRA: "Extra",
  RECEIVABLE: "Por cobrar",
};
const NEXT_KIND: Record<PlanIncomeKind, PlanIncomeKind> = {
  RECURRING: "EXTRA",
  EXTRA: "RECEIVABLE",
  RECEIVABLE: "RECURRING",
};

export default function PlanificadorPage() {
  const uid = useUid();
  const currentMonth = monthInMexicoCity();
  const currentYear = Number(currentMonth.slice(0, 4));
  const years = useMemo(() => {
    const start = Math.min(FIRST_PLAN_YEAR, currentYear);
    return Array.from({ length: currentYear + 4 - start + 1 }, (_, index) => start + index);
  }, [currentYear]);

  const [year, setYear] = useState(currentYear);
  const [docId, setDocId] = useState("");
  const [plan, setPlan] = useState<PlanDraft | null>(null);
  const [previousClosing, setPreviousClosing] = useState<number | null>(null);
  const [cut, setCut] = useState<FinancialCut | null>(null);
  const [cutPlans, setCutPlans] = useState<Record<number, PlanDraft | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [range, setRange] = useState<Range>("year");
  /** Cuenta ediciones para no perder las que ocurren mientras se guarda. */
  const editVersion = useRef(0);
  /** Ignora cargas viejas si cambias de año antes de que terminen. */
  const loadSequence = useRef(0);

  const load = useCallback(
    async (targetYear: number) => {
      if (!uid) return;
      const sequence = ++loadSequence.current;
      setLoading(true);
      setError(null);
      try {
        const [loaded, previous, latestCut] = await Promise.all([
          loadSavingsPlan(uid, targetYear),
          loadSavingsPlan(uid, targetYear - 1),
          // El corte es opcional: si no se puede leer, el plan sigue funcionando.
          loadLatestFinancialCut(uid).catch((cutError) => {
            console.error(cutError);
            return null;
          }),
        ]);
        if (sequence !== loadSequence.current) return;
        setDocId(loaded.docId);
        setPlan(loaded.plan);
        setDirty(false);
        setPreviousClosing(
          previous.exists ? computePlanMonths(previous.plan)[11].accumulated : null,
        );
        setCut(latestCut);
        setRange(loaded.plan.anchor ? "cut" : "year");
        if (latestCut) {
          const cutYear = Number(latestCut.date.slice(0, 4));
          const plans: Record<number, PlanDraft | undefined> = {};
          for (const y of [cutYear, cutYear + 1]) {
            if (y === targetYear) plans[y] = loaded.plan;
            else if (y === targetYear - 1) plans[y] = previous.plan;
            else plans[y] = (await loadSavingsPlan(uid, y)).plan;
          }
          if (sequence !== loadSequence.current) return;
          setCutPlans(plans);
        } else {
          setCutPlans({});
        }
      } catch (caught) {
        console.error(caught);
        if (sequence === loadSequence.current) {
          setError("No se pudo cargar el plan. Revisa tu conexión e inténtalo de nuevo.");
        }
      } finally {
        if (sequence === loadSequence.current) setLoading(false);
      }
    },
    [uid],
  );

  useEffect(() => {
    load(year);
  }, [year, load]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = useCallback((mutate: (draft: PlanDraft) => PlanDraft) => {
    editVersion.current += 1;
    setPlan((current) => (current ? mutate(current) : current));
    setDirty(true);
    setSavedAt(null);
  }, []);

  const months = useMemo(() => (plan ? computePlanMonths(plan) : []), [plan]);
  const anchorMonth = plan?.anchor?.month ?? null;
  const visibleMonths = useMemo(
    () => (range === "cut" && anchorMonth !== null ? ALL_MONTHS.filter((m) => m >= anchorMonth) : ALL_MONTHS),
    [range, anchorMonth],
  );
  const fromMonth = visibleMonths[0] ?? 0;
  const summary = useMemo(() => (months.length ? summarizePlanYear(months, fromMonth) : null), [months, fromMonth]);

  const validation = useMemo(() => {
    if (!cut || !plan) return null;
    const plans = { ...cutPlans, [plan.year]: plan };
    const relevant = Object.keys(plans).map(Number);
    if (!relevant.includes(plan.year)) return null;
    return evaluateFinancialCut(cut, plans);
  }, [cut, cutPlans, plan]);

  const handleSave = async () => {
    if (!uid || !plan || saving) return;
    const snapshot = plan;
    const snapshotDocId = docId;
    const startedAt = editVersion.current;
    setSaving(true);
    setError(null);
    try {
      const revision = await saveSavingsPlan(uid, snapshotDocId, snapshot);
      // Conserva lo que se haya tecleado durante el guardado.
      setPlan((current) => (current && current.year === snapshot.year ? { ...current, revision } : current));
      setCutPlans((current) => (snapshot.year in current ? { ...current, [snapshot.year]: { ...snapshot, revision } } : current));
      if (editVersion.current === startedAt) {
        setDirty(false);
        setSavedAt(new Date());
      }
    } catch (caught) {
      console.error(caught);
      if (caught instanceof SavingsPlanConflictError) {
        // Otro guardado (p. ej. ahorro real o hitos desde Finanzas) avanzó la
        // revisión: conserva tus líneas y toma lo más reciente del servidor.
        try {
          const latest = await loadSavingsPlan(uid, snapshot.year);
          setPlan((current) =>
            current && current.year === snapshot.year
              ? {
                  ...current,
                  revision: latest.plan.revision,
                  actualSavingsValues: latest.plan.actualSavingsValues,
                  milestones: latest.plan.milestones,
                }
              : current,
          );
          setError(
            "El plan se actualizó en otra pestaña o desde Finanzas. Conservamos tus cambios y tomamos el ahorro real y los hitos más recientes: revisa y guarda de nuevo.",
          );
        } catch {
          setError(caught.message);
        }
      } else {
        setError("No se pudo guardar el plan. Tus cambios siguen en pantalla.");
      }
    } finally {
      setSaving(false);
    }
  };

  const reload = () => {
    if (dirty && !window.confirm("Tienes cambios sin guardar. ¿Recargar y descartarlos?")) return;
    load(year);
  };

  const changeYear = (next: number) => {
    if (saving) return;
    if (dirty && !window.confirm("Tienes cambios sin guardar. ¿Cambiar de año y descartarlos?")) return;
    setYear(next);
  };

  // ── Edición de líneas ──
  const patchIncome = (id: string, patch: Partial<IncomeSourcePlan>) =>
    update((draft) => ({
      ...draft,
      incomeSources: draft.incomeSources.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));
  const patchExpense = (id: string, patch: Partial<PlanExpenseLine>) =>
    update((draft) => ({
      ...draft,
      expenseLines: draft.expenseLines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));
  const patchSavings = (id: string, patch: Partial<PlanSavingsLine>) =>
    update((draft) => ({
      ...draft,
      savingsLines: draft.savingsLines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));
  const confirmRemove = (name: string) => window.confirm(`¿Quitar "${name}" del plan?`);

  if (!uid || loading || !plan || !summary) {
    return (
      <div className="page-shell space-y-6" aria-busy="true">
        <div className="h-12 w-72 animate-pulse rounded-2xl bg-white/[0.04]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-white/[0.04]" />
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    );
  }

  const cutAccountsTotal = cut ? cut.accounts.reduce((acc, account) => acc + account.amount, 0) : 0;
  const periodLabel = fromMonth > 0 ? `${MONTH_LABELS[fromMonth]}–Dic` : `${plan.year}`;
  const carryOverDiffers =
    previousClosing !== null && !plan.anchor && Math.abs(previousClosing - plan.initialSavings) >= 1;
  // Mes en curso dentro del año que estás viendo: -1 si el año aún no empieza, 12 si ya terminó.
  const progressMonth =
    plan.year === currentYear ? Number(currentMonth.slice(5, 7)) - 1 : plan.year < currentYear ? 12 : -1;
  const progress = computeMonthProgress(plan, months, progressMonth);
  const progressSummary = summarizeProgress(progress);
  const milestoneProgress = computeMilestoneProgress(plan, months, progressMonth);
  const thisMonth = progressMonth >= 0 && progressMonth < 12 ? months[progressMonth] : null;
  const closing = months[11].accumulated;
  const signedMoney = (value: number) => `${value >= 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`;
  const tracked = progressSummary.trackedMonths;

  return (
    <div className="page-shell space-y-5 pb-28">
      <PageHeader
        icon={PiggyBank}
        tone="emerald"
        title="Planificador"
        subtitle="Tu ahorro mes a mes: lo que planeaste contra lo que de verdad pasó"
        actions={
          <>
            <SegmentedControl
              ariaLabel="Año del plan"
              options={years.map((value) => ({ value, label: value, disabled: saving && value !== year }))}
              value={year}
              onChange={changeYear}
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="btn-primary shrink-0 whitespace-nowrap px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {saving ? "Guardando…" : dirty ? "Guardar cambios" : savedAt ? "Guardado" : "Sin cambios"}
            </button>
          </>
        }
      />

      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </span>
          <button type="button" onClick={reload} className="inline-flex items-center gap-1.5 text-xs font-semibold underline-offset-2 hover:underline">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Recargar
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={!tracked ? "Avance contra el plan" : progressSummary.difference >= 0 ? "Vas arriba del plan" : "Vas abajo del plan"}
          icon={Target}
          tone={!tracked ? "default" : progressSummary.difference >= 0 ? "emerald" : "rose"}
          value={tracked ? signedMoney(progressSummary.difference) : "—"}
          hint={
            tracked
              ? `Ahorraste ${formatCurrency(progressSummary.realToDate)} de ${formatCurrency(progressSummary.planToDate)} planeados (${tracked} ${tracked === 1 ? "mes" : "meses"})`
              : "Escribe tu ahorro real en la lista de meses"
          }
        />
        <StatCard
          label={thisMonth ? `Este mes · ${MONTH_NAMES[thisMonth.month]}` : `Ahorro planeado ${plan.year}`}
          icon={CalendarRange}
          tone={thisMonth && thisMonth.net < 0 ? "rose" : "sky"}
          value={formatCurrency(thisMonth ? thisMonth.net : progress.reduce((acc, item) => acc + item.plan, 0))}
          hint={
            thisMonth
              ? `Entran ${formatCurrency(thisMonth.income)} · salen ${formatCurrency(thisMonth.spend)}`
              : "Ingresos menos gastos de todo el año"
          }
        />
        <StatCard
          label={`Cierre de ${plan.year}`}
          icon={Wallet}
          tone={closing < 0 ? "rose" : "amber"}
          value={formatCurrency(closing)}
          hint={
            `${
              plan.anchor
                ? `Parte de ${formatCurrency(plan.anchor.balance)} reales al ${plan.anchor.date}`
                : `Parte de ${formatCurrency(plan.initialSavings)} al iniciar el año`
            }${plan.earmarked ? ` · sin ${plan.earmarked.label}: ${formatCurrency(closing - plan.earmarked.amount)}` : ""}`
          }
        />
      </div>

      <section className="surface p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-zinc-100">Ahorro planeado vs. real</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-zinc-600" />Plan del mes</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />Real del mes</span>
            <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-amber-400" />Acumulado plan</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-sky-400" />Acumulado real</span>
          </div>
        </div>
        <ProgressChart progress={progress} />
      </section>

      <MonthTimeline
        progress={progress}
        months={months}
        onRealChange={(month, value) =>
          update((draft) => {
            const actualSavingsValues = [...draft.actualSavingsValues];
            actualSavingsValues[month] = value;
            return { ...draft, actualSavingsValues };
          })
        }
      />

      <section className="surface p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-zinc-100">Totales {periodLabel}</h2>
          {plan.anchor ? (
            <SegmentedControl
              ariaLabel="Periodo de los totales"
              size="sm"
              options={[
                { value: "cut" as Range, label: `Desde ${MONTH_NAMES[plan.anchor.month]}` },
                { value: "year" as Range, label: "Todo el año" },
              ]}
              value={range}
              onChange={setRange}
            />
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Ingresos", value: summary.income, tone: "text-emerald-300", hint: `Personal ${formatCurrency(summary.incomeByContext.PERSONAL)} · Negocio ${formatCurrency(summary.incomeByContext.BUSINESS)}` },
            { label: "Gastos", value: summary.spend, tone: "text-rose-300", hint: `Personal ${formatCurrency(summary.expensesByGroup.PERSONAL)} · Negocio ${formatCurrency(summary.expensesByGroup.BUSINESS)}` },
            {
              label: "Apartado",
              value: summary.reserved,
              tone: "text-sky-300",
              hint: plan.earmarked
                ? `Además, ${plan.earmarked.label}: ${formatCurrency(plan.earmarked.amount)}`
                : "Ahorro con nombre (sigue siendo tuyo)",
            },
            {
              label: "Libre",
              value: summary.free,
              tone: summary.free < 0 ? "text-rose-300" : "text-zinc-100",
              hint: summary.negativeFreeMonths.length
                ? `En rojo: ${summary.negativeFreeMonths.map((m) => MONTH_LABELS[m]).join(", ")}`
                : "Ningún mes en rojo",
            },
          ].map((item) => (
            <div key={item.label} className="surface-inset min-w-0 px-3.5 py-3">
              <dt className="eyebrow">{item.label}</dt>
              <dd className={cn("num mt-1 truncate font-mono text-lg font-bold", item.tone)}>{formatCurrency(item.value)}</dd>
              <dd className="mt-0.5 text-[11px] leading-snug text-zinc-500">{item.hint}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Disclosure
        icon={Pencil}
        title="Editar plan"
        description="Ingresos, gastos y apartados que arman el plan de cada mes"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-zinc-400">
          {plan.anchor ? (
            <p>
              Desde {MONTH_NAMES[plan.anchor.month]} el plan parte de tu dinero real al corte:{" "}
              <span className="font-semibold text-amber-200">{formatCurrency(plan.anchor.balance)}</span>
            </p>
          ) : (
            <>
              <label className="flex items-center gap-2">
                Saldo al iniciar {plan.year}
                <MoneyInput
                  variant="field"
                  value={plan.initialSavings}
                  onChange={(value) => update((draft) => ({ ...draft, initialSavings: value }))}
                  ariaLabel="Saldo inicial del año"
                  placeholder="0"
                  className="w-36"
                />
              </label>
              {carryOverDiffers ? (
                <button
                  type="button"
                  className="text-amber-300 underline-offset-2 hover:underline"
                  onClick={() => update((draft) => ({ ...draft, initialSavings: previousClosing ?? 0 }))}
                >
                  Usar cierre proyectado de {plan.year - 1}: {formatCurrency(previousClosing ?? 0)}
                </button>
              ) : null}
            </>
          )}
          <label className="flex flex-wrap items-center gap-2">
            Ya apartado de ese dinero
            <input
              type="text"
              value={plan.earmarked?.label ?? ""}
              placeholder="p. ej. Fondo del coche"
              aria-label="Para qué está apartado el dinero inicial"
              onChange={(event) => {
                const label = event.target.value;
                update((draft) => ({ ...draft, earmarked: { label, amount: draft.earmarked?.amount ?? 0 } }));
              }}
              className="h-9 w-44 rounded-lg border border-white/10 bg-black/30 px-2.5 text-sm text-zinc-100 outline-none transition-colors focus:border-amber-500/40"
            />
            <MoneyInput
              variant="field"
              value={plan.earmarked?.amount ?? 0}
              onChange={(amount) =>
                update((draft) => ({
                  ...draft,
                  earmarked: amount > 0 || draft.earmarked?.label ? { label: draft.earmarked?.label || "Apartado", amount } : null,
                }))
              }
              ariaLabel="Monto apartado del dinero inicial"
              placeholder="0"
              className="w-32"
            />
          </label>
        </div>

      <PlanLineTable
        title="Ingresos"
        description="Sueldos, proyectos, extras y cobros pendientes"
        icon={TrendingUp}
        accent="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
        lines={plan.incomeSources}
        visibleMonths={visibleMonths}
        valueTone="text-emerald-200"
        onChange={patchIncome}
        onAdd={() =>
          update((draft) => ({
            ...draft,
            incomeSources: [
              ...draft.incomeSources,
              { id: newId("income"), name: "Nuevo ingreso", values: zeros(), context: "PERSONAL", kind: "RECURRING" },
            ],
          }))
        }
        onRemove={(id) => {
          const line = plan.incomeSources.find((item) => item.id === id);
          if (line && confirmRemove(line.name)) {
            update((draft) => ({ ...draft, incomeSources: draft.incomeSources.filter((item) => item.id !== id) }));
          }
        }}
        addLabel="Ingreso"
        emptyLabel="Sin ingresos registrados."
        renderTag={(line) => (
          <>
            <button
              type="button"
              onClick={() => patchIncome(line.id, { kind: NEXT_KIND[line.kind ?? "RECURRING"] })}
              title="Cambiar tipo: fijo, extra o por cobrar"
              className="hidden shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2 py-0.5 text-[11px] font-semibold text-emerald-200 sm:inline-block"
            >
              {INCOME_KIND_LABEL[line.kind ?? "RECURRING"]}
            </button>
            <ContextTag
              context={line.context ?? "PERSONAL"}
              onToggle={() => patchIncome(line.id, { context: line.context === "BUSINESS" ? "PERSONAL" : "BUSINESS" })}
            />
          </>
        )}
      />

      {EXPENSE_GROUPS.map((group) => {
        const meta = GROUP_META[group];
        return (
          <PlanLineTable
            key={group}
            title={meta.title}
            description={meta.description}
            icon={GROUP_ICONS[group]}
            accent={meta.accent}
            lines={plan.expenseLines.filter(
              (line) =>
                line.group === group &&
                // El total heredado (ene–oct) no aporta nada en meses donde ya hay desglose.
                !(line.id === LEGACY_EXPENSE_LINE_ID && visibleMonths.every((month) => !line.values[month])),
            )}
            visibleMonths={visibleMonths}
            valueTone="text-zinc-100"
            onChange={patchExpense}
            onAdd={() =>
              update((draft) => ({
                ...draft,
                expenseLines: [
                  ...draft.expenseLines,
                  {
                    id: newId(group.toLowerCase()),
                    name: "Nuevo concepto",
                    group,
                    context: group === "BUSINESS" ? "BUSINESS" : "PERSONAL",
                    values: zeros(),
                  },
                ],
              }))
            }
            onRemove={(id) => {
              const line = plan.expenseLines.find((item) => item.id === id);
              if (line && confirmRemove(line.name)) {
                update((draft) => ({ ...draft, expenseLines: draft.expenseLines.filter((item) => item.id !== id) }));
              }
            }}
            addLabel={meta.add}
            emptyLabel={meta.empty}
            moveOptions={EXPENSE_GROUPS.filter((target) => target !== group).map((target) => ({
              value: target,
              label: GROUP_META[target].title.toLowerCase(),
            }))}
            onMove={(id, target) =>
              patchExpense(id, {
                group: target as PlanExpenseGroup,
                ...(target === "BUSINESS" ? { context: "BUSINESS" as const } : group === "BUSINESS" ? { context: "PERSONAL" as const } : {}),
              })
            }
            renderTag={
              group === "BUSINESS"
                ? undefined
                : (line) => (
                    <ContextTag
                      context={line.context}
                      onToggle={() => patchExpense(line.id, { context: line.context === "BUSINESS" ? "PERSONAL" : "BUSINESS" })}
                    />
                  )
            }
          />
        );
      })}

      <PlanLineTable
        title="Apartados de ahorro"
        description="Dinero que separas: no es gasto, pero deja de estar libre"
        icon={PiggyBank}
        accent="border-sky-500/20 bg-sky-500/10 text-sky-300"
        lines={plan.savingsLines}
        visibleMonths={visibleMonths}
        valueTone="text-sky-200"
        onChange={patchSavings}
        onAdd={() =>
          update((draft) => ({
            ...draft,
            savingsLines: [...draft.savingsLines, { id: newId("savings"), name: "Nuevo apartado", values: zeros() }],
          }))
        }
        onRemove={(id) => {
          const line = plan.savingsLines.find((item) => item.id === id);
          if (line && confirmRemove(line.name)) {
            update((draft) => ({ ...draft, savingsLines: draft.savingsLines.filter((item) => item.id !== id) }));
          }
        }}
        addLabel="Apartado"
        emptyLabel="Sin apartados de ahorro."
      />

      </Disclosure>

      {cut && validation ? (
        <Disclosure
          icon={Landmark}
          title={cut.label}
          description={`Validación del corte · total en cuentas ${formatCurrency(cutAccountsTotal)}`}
        >
          <p className="px-1 text-xs text-zinc-400">
            {cut.accounts.map((account) => `${account.name} ${formatCurrency(account.amount)}`).join(" · ")}
          </p>
          <CutValidation cut={cut} results={validation} />
        </Disclosure>
      ) : null}

      <Disclosure
        icon={Flag}
        title="Hitos"
        description={
          plan.milestones.length
            ? (
                [
                  ["REACHED", "alcanzada"],
                  ["ON_TRACK", "en camino"],
                  ["BEHIND", "no alcanza"],
                  ["MISSED", "no se alcanzó"],
                ] as const
              )
                .map(([status, label]) => [milestoneProgress.filter((item) => item.status === status).length, label] as const)
                .filter(([count]) => count > 0)
                .map(([count, label]) => `${count} ${label}`)
                .join(" · ")
            : "Metas de dinero con fecha"
        }
      >
        <MilestonesPanel
          milestones={plan.milestones}
          progress={milestoneProgress}
          excludedLabel={plan.earmarked?.label}
          onChange={(id, patch: Partial<PlanMilestone>) =>
            update((draft) => ({
              ...draft,
              milestones: draft.milestones.map((item) => {
                if (item.id !== id) return item;
                const next = { ...item, ...patch };
                if (next.endMonth < next.startMonth) next.endMonth = next.startMonth;
                return next;
              }),
            }))
          }
          onAdd={() =>
            update((draft) => ({
              ...draft,
              milestones: [
                ...draft.milestones,
                { id: crypto.randomUUID(), name: "Nuevo hito", amount: 0, startMonth: fromMonth, endMonth: 11 },
              ],
            }))
          }
          onRemove={(id) => {
            const milestone = plan.milestones.find((item) => item.id === id);
            if (milestone && confirmRemove(milestone.name)) {
              update((draft) => ({ ...draft, milestones: draft.milestones.filter((item) => item.id !== id) }));
            }
          }}
        />
      </Disclosure>

      {dirty ? (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 lg:pl-[264px]">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-[#0b0b0d]/95 px-4 py-2.5 shadow-2xl backdrop-blur">
            <span className="text-sm text-zinc-200">Cambios sin guardar</span>
            <button type="button" onClick={reload} className="btn-ghost px-3 py-1.5 text-xs">
              Descartar
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary px-3 py-1.5 text-xs">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
