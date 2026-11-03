import type {
  FinancialContext,
  FinancialCut,
  FinancialCutCheck,
  FinancialCutTerm,
  IncomeSourcePlan,
  PlanAnchor,
  PlanEarmark,
  PlanExpenseGroup,
  PlanExpenseLine,
  PlanIncomeKind,
  PlanMilestone,
  PlanSavingsLine,
} from "@/lib/types";

export const PLAN_MONTHS = 12;
export const PLAN_SCHEMA_VERSION = 2 as const;
export const LEGACY_EXPENSE_LINE_ID = "legacy-expenses";

export const EXPENSE_GROUPS: PlanExpenseGroup[] = [
  "PERSONAL",
  "BUSINESS",
  "ONE_OFF",
  "DEBT",
];

/** Plan editable y normalizado: arreglos de 12 meses y montos con 2 decimales. */
export interface PlanDraft {
  year: number;
  revision: number;
  initialSavings: number;
  incomeSources: IncomeSourcePlan[];
  expenseLines: PlanExpenseLine[];
  savingsLines: PlanSavingsLine[];
  anchor: PlanAnchor | null;
  /** Del dinero inicial (o del corte), cuánto ya está apartado y para qué. */
  earmarked: PlanEarmark | null;
  actualSavingsValues: number[];
  milestones: PlanMilestone[];
}

export interface PlanMonth {
  month: number;
  income: number;
  incomeByContext: Record<FinancialContext, number>;
  receivables: number;
  expensesByGroup: Record<PlanExpenseGroup, number>;
  expensesByContext: Record<FinancialContext, number>;
  /** Todo lo que sale de tus cuentas (personal + negocio + puntual + deuda). */
  spend: number;
  /** Dinero que apartas (fondos de ahorro). */
  reserved: number;
  /** Cambio del dinero total: ingresos − gastos. */
  net: number;
  /** Lo que queda sin destino: neto − apartado. */
  free: number;
  /** Dinero total proyectado al cierre del mes. */
  accumulated: number;
  reservedAccumulated: number;
  /** El mes arranca desde el saldo real del corte. */
  anchored: boolean;
}

export interface PlanYearSummary {
  income: number;
  spend: number;
  reserved: number;
  net: number;
  free: number;
  expensesByGroup: Record<PlanExpenseGroup, number>;
  incomeByContext: Record<FinancialContext, number>;
  closing: number;
  lowestBalance: { month: number; value: number };
  negativeFreeMonths: number[];
}

export function roundMoney(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
}

export function normalizeMonthValues(values: unknown): number[] {
  const source = Array.isArray(values) ? values : [];
  return Array.from({ length: PLAN_MONTHS }, (_, index) =>
    roundMoney(source[index]),
  );
}

function sum(values: number[]): number {
  return roundMoney(values.reduce((acc, value) => acc + value, 0));
}

function cleanText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asContext(value: unknown): FinancialContext {
  return value === "BUSINESS" ? "BUSINESS" : "PERSONAL";
}

function asIncomeKind(value: unknown): PlanIncomeKind {
  return value === "EXTRA" || value === "RECEIVABLE" ? value : "RECURRING";
}

function asGroup(value: unknown): PlanExpenseGroup {
  return EXPENSE_GROUPS.includes(value as PlanExpenseGroup)
    ? (value as PlanExpenseGroup)
    : "PERSONAL";
}

function lineId(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/**
 * Normaliza un documento de `savings_plans` (v1 o v2). Un plan v1 solo tiene
 * `expensesValues`; se convierte en una línea "Gastos sin desglose" para no
 * perder el histórico.
 */
export function normalizeSavingsPlan(
  raw: Record<string, unknown> | null | undefined,
  year: number,
): PlanDraft {
  const data = raw ?? {};
  const incomeSources = (Array.isArray(data.incomeSources) ? data.incomeSources : []).map(
    (item: Record<string, unknown>, index: number): IncomeSourcePlan => ({
      id: lineId(item?.id, `income-${index + 1}`),
      name: cleanText(item?.name, `Ingreso ${index + 1}`),
      values: normalizeMonthValues(item?.values),
      context: asContext(item?.context),
      kind: asIncomeKind(item?.kind),
      ...(typeof item?.notes === "string" && item.notes.trim()
        ? { notes: item.notes.trim() }
        : {}),
    }),
  );

  let expenseLines: PlanExpenseLine[] = (
    Array.isArray(data.expenseLines) ? data.expenseLines : []
  ).map(
    (item: Record<string, unknown>, index: number): PlanExpenseLine => ({
      id: lineId(item?.id, `expense-${index + 1}`),
      name: cleanText(item?.name, `Gasto ${index + 1}`),
      group: asGroup(item?.group),
      context: asContext(item?.context),
      values: normalizeMonthValues(item?.values),
      ...(typeof item?.notes === "string" && item.notes.trim()
        ? { notes: item.notes.trim() }
        : {}),
    }),
  );

  if (expenseLines.length === 0 && !Array.isArray(data.expenseLines)) {
    const legacy = normalizeMonthValues(data.expensesValues);
    if (legacy.some((value) => value !== 0)) {
      expenseLines = [
        {
          id: LEGACY_EXPENSE_LINE_ID,
          name: "Gastos sin desglose",
          group: "PERSONAL",
          context: "PERSONAL",
          values: legacy,
          notes: "Total mensual del planificador anterior",
        },
      ];
    }
  }

  const savingsLines = (Array.isArray(data.savingsLines) ? data.savingsLines : []).map(
    (item: Record<string, unknown>, index: number): PlanSavingsLine => ({
      id: lineId(item?.id, `savings-${index + 1}`),
      name: cleanText(item?.name, `Apartado ${index + 1}`),
      values: normalizeMonthValues(item?.values),
      ...(typeof item?.notes === "string" && item.notes.trim()
        ? { notes: item.notes.trim() }
        : {}),
    }),
  );

  const anchorRaw = data.anchor as Record<string, unknown> | null | undefined;
  const anchorMonth = Number(anchorRaw?.month);
  const anchor: PlanAnchor | null =
    anchorRaw &&
    Number.isInteger(anchorMonth) &&
    anchorMonth >= 0 &&
    anchorMonth < PLAN_MONTHS &&
    typeof anchorRaw.cutId === "string"
      ? {
          cutId: anchorRaw.cutId,
          date: typeof anchorRaw.date === "string" ? anchorRaw.date : "",
          month: anchorMonth,
          balance: roundMoney(anchorRaw.balance),
        }
      : null;

  const earmarkRaw = data.earmarked as Record<string, unknown> | null | undefined;
  const earmarkAmount = roundMoney(earmarkRaw?.amount);
  const earmarked: PlanEarmark | null =
    earmarkRaw && typeof earmarkRaw === "object" && earmarkAmount > 0
      ? { label: cleanText(earmarkRaw.label, "Apartado"), amount: earmarkAmount }
      : null;

  const milestones = (Array.isArray(data.milestones) ? data.milestones : []).map(
    (item: Record<string, unknown>, index: number): PlanMilestone => {
      const startMonth = clampMonth(item?.startMonth);
      const endMonth = Math.max(startMonth, clampMonth(item?.endMonth));
      return {
        ...(item as unknown as PlanMilestone),
        id: lineId(item?.id, `milestone-${index + 1}`),
        name: cleanText(item?.name, `Hito ${index + 1}`),
        amount: roundMoney(item?.amount),
        startMonth,
        endMonth,
      };
    },
  );

  const revision = Number(data.revision);
  return {
    year,
    revision: Number.isInteger(revision) && revision >= 0 ? revision : 0,
    initialSavings: roundMoney(data.initialSavings),
    incomeSources,
    expenseLines,
    savingsLines,
    anchor,
    earmarked,
    actualSavingsValues: normalizeMonthValues(data.actualSavingsValues),
    milestones,
  };
}

function clampMonth(value: unknown): number {
  const numeric = Math.trunc(Number(value));
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(PLAN_MONTHS - 1, Math.max(0, numeric));
}

export function emptyGroupTotals(): Record<PlanExpenseGroup, number> {
  return { PERSONAL: 0, BUSINESS: 0, ONE_OFF: 0, DEBT: 0 };
}

export function computePlanMonths(plan: PlanDraft): PlanMonth[] {
  const months: PlanMonth[] = [];
  let accumulated = plan.initialSavings;
  // Lo apartado del dinero inicial cuenta desde el arranque (o desde el corte).
  let reservedAccumulated = plan.anchor ? 0 : plan.earmarked?.amount ?? 0;

  for (let month = 0; month < PLAN_MONTHS; month += 1) {
    const incomeByContext: Record<FinancialContext, number> = {
      PERSONAL: 0,
      BUSINESS: 0,
    };
    let receivables = 0;
    for (const source of plan.incomeSources) {
      const value = source.values[month] ?? 0;
      incomeByContext[source.context ?? "PERSONAL"] += value;
      if (source.kind === "RECEIVABLE") receivables += value;
    }
    const expensesByGroup = emptyGroupTotals();
    const expensesByContext: Record<FinancialContext, number> = {
      PERSONAL: 0,
      BUSINESS: 0,
    };
    for (const line of plan.expenseLines) {
      const value = line.values[month] ?? 0;
      expensesByGroup[line.group] += value;
      expensesByContext[line.context] += value;
    }
    const reserved = roundMoney(
      plan.savingsLines.reduce((acc, line) => acc + (line.values[month] ?? 0), 0),
    );
    const income = roundMoney(incomeByContext.PERSONAL + incomeByContext.BUSINESS);
    const spend = roundMoney(
      expensesByGroup.PERSONAL +
        expensesByGroup.BUSINESS +
        expensesByGroup.ONE_OFF +
        expensesByGroup.DEBT,
    );
    const net = roundMoney(income - spend);
    const anchored = plan.anchor !== null && month >= plan.anchor.month;
    if (plan.anchor && month === plan.anchor.month) {
      accumulated = plan.anchor.balance;
      reservedAccumulated = plan.earmarked?.amount ?? 0;
    }
    accumulated = roundMoney(accumulated + net);
    reservedAccumulated = roundMoney(reservedAccumulated + reserved);

    months.push({
      month,
      income,
      incomeByContext: {
        PERSONAL: roundMoney(incomeByContext.PERSONAL),
        BUSINESS: roundMoney(incomeByContext.BUSINESS),
      },
      receivables: roundMoney(receivables),
      expensesByGroup: {
        PERSONAL: roundMoney(expensesByGroup.PERSONAL),
        BUSINESS: roundMoney(expensesByGroup.BUSINESS),
        ONE_OFF: roundMoney(expensesByGroup.ONE_OFF),
        DEBT: roundMoney(expensesByGroup.DEBT),
      },
      expensesByContext: {
        PERSONAL: roundMoney(expensesByContext.PERSONAL),
        BUSINESS: roundMoney(expensesByContext.BUSINESS),
      },
      spend,
      reserved,
      net,
      free: roundMoney(net - reserved),
      accumulated,
      reservedAccumulated,
      anchored,
    });
  }
  return months;
}

export function summarizePlanYear(
  months: PlanMonth[],
  fromMonth = 0,
): PlanYearSummary {
  const scope = months.filter((month) => month.month >= fromMonth);
  const expensesByGroup = emptyGroupTotals();
  const incomeByContext: Record<FinancialContext, number> = {
    PERSONAL: 0,
    BUSINESS: 0,
  };
  for (const month of scope) {
    for (const group of EXPENSE_GROUPS) expensesByGroup[group] += month.expensesByGroup[group];
    incomeByContext.PERSONAL += month.incomeByContext.PERSONAL;
    incomeByContext.BUSINESS += month.incomeByContext.BUSINESS;
  }
  const lowest = scope.reduce(
    (acc, month) => (month.accumulated < acc.value ? { month: month.month, value: month.accumulated } : acc),
    { month: scope[0]?.month ?? 0, value: scope[0]?.accumulated ?? 0 },
  );
  return {
    income: sum(scope.map((month) => month.income)),
    spend: sum(scope.map((month) => month.spend)),
    reserved: sum(scope.map((month) => month.reserved)),
    net: sum(scope.map((month) => month.net)),
    free: sum(scope.map((month) => month.free)),
    expensesByGroup: {
      PERSONAL: roundMoney(expensesByGroup.PERSONAL),
      BUSINESS: roundMoney(expensesByGroup.BUSINESS),
      ONE_OFF: roundMoney(expensesByGroup.ONE_OFF),
      DEBT: roundMoney(expensesByGroup.DEBT),
    },
    incomeByContext: {
      PERSONAL: roundMoney(incomeByContext.PERSONAL),
      BUSINESS: roundMoney(incomeByContext.BUSINESS),
    },
    closing: months[months.length - 1]?.accumulated ?? 0,
    lowestBalance: lowest,
    negativeFreeMonths: scope.filter((month) => month.free < 0).map((month) => month.month),
  };
}

/** Total mensual que leen Finanzas y Dashboard (compatibilidad con v1). */
export function legacyExpensesValues(plan: PlanDraft): number[] {
  return computePlanMonths(plan).map((month) => month.spend);
}

export function planToFirestoreData(plan: PlanDraft, userId: string) {
  return {
    userId,
    year: plan.year,
    schemaVersion: PLAN_SCHEMA_VERSION,
    initialSavings: roundMoney(plan.initialSavings),
    incomeSources: plan.incomeSources.map((source) => ({
      id: source.id,
      name: source.name.trim() || "Ingreso",
      values: normalizeMonthValues(source.values),
      context: source.context ?? "PERSONAL",
      kind: source.kind ?? "RECURRING",
      ...(source.notes ? { notes: source.notes } : {}),
    })),
    expenseLines: plan.expenseLines.map((line) => ({
      id: line.id,
      name: line.name.trim() || "Gasto",
      group: line.group,
      context: line.context,
      values: normalizeMonthValues(line.values),
      ...(line.notes ? { notes: line.notes } : {}),
    })),
    savingsLines: plan.savingsLines.map((line) => ({
      id: line.id,
      name: line.name.trim() || "Apartado",
      values: normalizeMonthValues(line.values),
      ...(line.notes ? { notes: line.notes } : {}),
    })),
    anchor: plan.anchor,
    earmarked: plan.earmarked
      ? { label: plan.earmarked.label.trim() || "Apartado", amount: roundMoney(plan.earmarked.amount) }
      : null,
    expensesValues: legacyExpensesValues(plan),
    actualSavingsValues: normalizeMonthValues(plan.actualSavingsValues),
    milestones: plan.milestones,
  };
}

/** Rellena desde `fromMonth` hasta diciembre con el valor de ese mes. */
export function repeatFromMonth(values: number[], fromMonth: number): number[] {
  const normalized = normalizeMonthValues(values);
  const start = clampMonth(fromMonth);
  const seed = normalized[start];
  return normalized.map((value, index) => (index >= start ? seed : value));
}

export function savingsPlanDocumentId(userId: string, year: number): string {
  return `${userId}_${year}`;
}

// ─────────────────────────────────────────────
// Validación del corte financiero
// ─────────────────────────────────────────────

export type CutCheckStatus = "OK" | "MISMATCH" | "WARNING" | "MISSING";

export interface CutCheckResult {
  id: string;
  label: string;
  declared: number;
  computed: number;
  difference: number;
  status: CutCheckStatus;
  note?: string;
  missing: string[];
}

export function sumAccounts(cut: Pick<FinancialCut, "accounts">): number {
  return sum(cut.accounts.map((account) => roundMoney(account.amount)));
}

function findLineValues(plan: PlanDraft | undefined, lineId: string): number[] | null {
  if (!plan) return null;
  const line =
    plan.incomeSources.find((item) => item.id === lineId) ??
    plan.expenseLines.find((item) => item.id === lineId) ??
    plan.savingsLines.find((item) => item.id === lineId);
  return line ? line.values : null;
}

export function evaluateCutCheck(
  check: FinancialCutCheck,
  cut: Pick<FinancialCut, "accounts">,
  plansByYear: Record<number, PlanDraft | undefined>,
): CutCheckResult {
  const missing: string[] = [];
  let computed = 0;
  for (const term of check.terms) {
    const sign = term.sign === -1 ? -1 : 1;
    if (term.kind === "accounts") {
      computed += sign * sumAccounts(cut);
    } else if (term.kind === "constant") {
      computed += sign * roundMoney(term.value);
    } else {
      const values = findLineValues(plansByYear[term.year], term.lineId);
      if (!values) {
        missing.push(`${term.year}:${term.lineId}`);
        continue;
      }
      for (const month of term.months) computed += sign * (values[month] ?? 0);
    }
  }
  computed = roundMoney(computed);
  const declared = roundMoney(check.declared);
  const difference = roundMoney(computed - declared);
  const status: CutCheckStatus =
    missing.length > 0
      ? "MISSING"
      : Math.abs(difference) < 1
        ? "OK"
        : check.severity === "WARNING"
          ? "WARNING"
          : "MISMATCH";
  return {
    id: check.id,
    label: check.label,
    declared,
    computed,
    difference,
    status,
    ...(check.note ? { note: check.note } : {}),
    missing,
  };
}

export function evaluateFinancialCut(
  cut: Pick<FinancialCut, "accounts" | "checks">,
  plansByYear: Record<number, PlanDraft | undefined>,
): CutCheckResult[] {
  return cut.checks.map((check) => evaluateCutCheck(check, cut, plansByYear));
}

export function normalizeFinancialCut(
  raw: Record<string, unknown> | null | undefined,
  id: string,
): FinancialCut | null {
  if (!raw) return null;
  const accounts = (Array.isArray(raw.accounts) ? raw.accounts : []).map(
    (item: Record<string, unknown>, index: number) => ({
      id: lineId(item?.id, `account-${index + 1}`),
      name: cleanText(item?.name, `Cuenta ${index + 1}`),
      amount: roundMoney(item?.amount),
    }),
  );
  const checks = (Array.isArray(raw.checks) ? raw.checks : []).flatMap(
    (item: Record<string, unknown>): FinancialCutCheck[] => {
      if (!item || typeof item !== "object" || !Array.isArray(item.terms)) return [];
      const terms = item.terms.flatMap((term: Record<string, unknown>): FinancialCutTerm[] => {
        const sign = term?.sign === -1 ? -1 : 1;
        if (term?.kind === "accounts") return [{ kind: "accounts", sign }];
        if (term?.kind === "constant" && Number.isFinite(Number(term.value))) {
          return [{ kind: "constant", value: Number(term.value), label: String(term.label ?? ""), sign }];
        }
        if (
          term?.kind === "line" &&
          Number.isInteger(term.year) &&
          typeof term.lineId === "string" &&
          Array.isArray(term.months)
        ) {
          const months = term.months.filter(
            (month: unknown): month is number => Number.isInteger(month) && (month as number) >= 0 && (month as number) < PLAN_MONTHS,
          );
          return [{ kind: "line", year: term.year as number, lineId: term.lineId, months, sign }];
        }
        return [];
      });
      return [
        {
          id: lineId(item.id, `check-${terms.length}`),
          label: cleanText(item.label, "Validación"),
          declared: roundMoney(item.declared),
          terms,
          ...(item.severity === "WARNING" ? { severity: "WARNING" as const } : {}),
          ...(typeof item.note === "string" && item.note.trim() ? { note: item.note.trim() } : {}),
        },
      ];
    },
  );
  return {
    id,
    userId: typeof raw.userId === "string" ? raw.userId : "",
    date: typeof raw.date === "string" ? raw.date : id,
    label: cleanText(raw.label, `Corte ${id}`),
    accounts,
    checks,
    notes: (Array.isArray(raw.notes) ? raw.notes : []).filter(
      (note): note is string => typeof note === "string" && note.trim().length > 0,
    ),
    revision: Number.isInteger(raw.revision) ? (raw.revision as number) : 0,
  };
}

// ─────────────────────────────────────────────
// Avance mes a mes (plan contra real)
// ─────────────────────────────────────────────

/** EMPTY: mes pasado sin plan ni registro (no hay nada que comparar). */
export type MonthProgressStatus = "DONE" | "MISSING" | "EMPTY" | "CURRENT" | "FUTURE";

export interface MonthProgress {
  month: number;
  /** Ahorro planeado del mes: ingresos − gastos. */
  plan: number;
  /** Ahorro real registrado; null si no se capturó. */
  real: number | null;
  /** real − plan (solo si hay real). */
  difference: number | null;
  status: MonthProgressStatus;
  planAccumulated: number;
  /** Dinero real acumulado; null en meses sin registro posteriores al último real. */
  realAccumulated: number | null;
}

export interface ProgressSummary {
  trackedMonths: number;
  planToDate: number;
  realToDate: number;
  difference: number;
  lastRealAccumulated: number | null;
}

/**
 * Compara mes a mes el ahorro planeado con el real. `currentMonth` es el
 * índice (0–11) del mes en curso dentro del año del plan, o null si el año
 * ya terminó (12) / todavía no empieza (-1).
 */
export function computeMonthProgress(
  plan: PlanDraft,
  months: PlanMonth[],
  currentMonth: number,
): MonthProgress[] {
  let realAccumulated = plan.initialSavings;
  let lastRealMonth = -1;
  plan.actualSavingsValues.forEach((value, index) => {
    if (value) lastRealMonth = index;
  });

  return months.map((month) => {
    const raw = plan.actualSavingsValues[month.month] ?? 0;
    const hasReal = raw !== 0;
    if (plan.anchor && month.month === plan.anchor.month) {
      realAccumulated = plan.anchor.balance;
    }
    realAccumulated = roundMoney(realAccumulated + raw);
    const status: MonthProgressStatus =
      month.month < currentMonth
        ? hasReal
          ? "DONE"
          : month.net
            ? "MISSING"
            : "EMPTY"
        : month.month === currentMonth
          ? hasReal
            ? "DONE"
            : "CURRENT"
          : hasReal
            ? "DONE"
            : "FUTURE";
    return {
      month: month.month,
      plan: month.net,
      real: hasReal ? raw : null,
      difference: hasReal ? roundMoney(raw - month.net) : null,
      status,
      planAccumulated: month.accumulated,
      realAccumulated: month.month <= Math.max(lastRealMonth, Math.min(currentMonth, 11)) ? realAccumulated : null,
    };
  });
}

export function summarizeProgress(progress: MonthProgress[]): ProgressSummary {
  const tracked = progress.filter((item) => item.real !== null);
  const planToDate = sum(tracked.map((item) => item.plan));
  const realToDate = sum(tracked.map((item) => item.real ?? 0));
  const withReal = progress.filter((item) => item.realAccumulated !== null);
  return {
    trackedMonths: tracked.length,
    planToDate,
    realToDate,
    difference: roundMoney(realToDate - planToDate),
    lastRealAccumulated: withReal.length ? withReal[withReal.length - 1].realAccumulated : null,
  };
}

// ── Hitos (metas de dinero) con avance automático ──

/**
 * REACHED: el dinero real ya llegó a la meta · MISSED: la fecha pasó sin llegar ·
 * ON_TRACK: el plan llega a tiempo · BEHIND: con el plan no alcanza.
 */
export type MilestoneProgressStatus = "REACHED" | "MISSED" | "ON_TRACK" | "BEHIND";

export interface MilestoneProgress {
  id: string;
  name: string;
  target: number;
  /** Dinero real (sin lo apartado con destino) al último mes con dato dentro del plazo; null si aún no hay. */
  current: number | null;
  asOfMonth: number | null;
  /** Dinero proyectado (sin lo apartado con destino) al cierre del plazo. */
  projected: number;
  percent: number;
  status: MilestoneProgressStatus;
}

/** Lo apartado del dinero inicial no cuenta para otras metas: ya tiene destino. */
function earmarkedAt(plan: PlanDraft, month: number): number {
  if (!plan.earmarked) return 0;
  if (plan.anchor && month < plan.anchor.month) return 0;
  return plan.earmarked.amount;
}

/**
 * Avance de cada hito calculado solo: dinero real acumulado (ahorro registrado
 * y corte) hasta su fecha límite, y la proyección del plan a esa fecha.
 */
export function computeMilestoneProgress(
  plan: PlanDraft,
  months: PlanMonth[],
  currentMonth: number,
): MilestoneProgress[] {
  const progress = computeMonthProgress(plan, months, currentMonth);
  return plan.milestones.map((milestone) => {
    const endMonth = Math.min(PLAN_MONTHS - 1, Math.max(0, milestone.endMonth));
    let asOfMonth: number | null = null;
    for (let month = endMonth; month >= 0; month -= 1) {
      if (progress[month]?.realAccumulated !== null && progress[month]?.realAccumulated !== undefined) {
        asOfMonth = month;
        break;
      }
    }
    const current =
      asOfMonth === null ? null : roundMoney((progress[asOfMonth].realAccumulated ?? 0) - earmarkedAt(plan, asOfMonth));
    const projected = roundMoney((months[endMonth]?.accumulated ?? 0) - earmarkedAt(plan, endMonth));
    const target = roundMoney(milestone.amount);
    const percent =
      target > 0 && current !== null ? Math.min(100, Math.max(0, Math.round((current / target) * 100))) : 0;
    const status: MilestoneProgressStatus =
      current !== null && target > 0 && current >= target
        ? "REACHED"
        : endMonth < currentMonth
          ? "MISSED"
          : target > 0 && projected >= target
            ? "ON_TRACK"
            : "BEHIND";
    return { id: milestone.id, name: milestone.name, target, current, asOfMonth, projected, percent, status };
  });
}
