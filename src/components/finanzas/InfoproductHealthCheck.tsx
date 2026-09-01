"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Expense,
  InfoproductOp,
  InfoproductFixedExpense,
} from "@/lib/types";
import type { VibeBusinessSummary } from "@/contracts/vibe-business";
import {
  createFinance,
  createInfoproductFixedExpenseVersion,
  FinanceRecurrenceConflictError,
  updateFinance,
  removeFinance,
} from "@/lib/repositories/firestore";
import { formatCurrency, formatCurrencyPrecise, cn } from "@/lib/utils";
import { classifyBusinessHealth } from "@/lib/finance/business-health";
import {
  addMonthsToMonthKey,
  calculateBusinessPosition,
  isVibeBusinessSummaryComplete,
  normalizeConcept,
  recurringFixedSeriesId,
  resolveCombinedBusinessFixedExpenses,
  resolveRecurringFixedExpenses,
} from "@/lib/finance/business-metrics";
import { monthInMexicoCity } from "@/lib/time/month";
import VibeBusinessSnapshotCard from "@/components/finanzas/VibeBusinessSnapshotCard";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Layers,
  ShoppingBag,
  Wallet,
  Settings,
  Grid,
} from "lucide-react";

type VibeCacheEntry = {
  summary: VibeBusinessSummary | null;
  loading: boolean;
  error: string;
  fetchedAt: number;
};

const VIBE_REFRESH_INTERVAL_MS = 5 * 60 * 1_000;

function nonNegativeAmount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function nonNegativeSales(value: number | null | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function sanitizeOperation(operation: InfoproductOp): InfoproductOp {
  return {
    ...operation,
    adSpend: nonNegativeAmount(operation.adSpend),
    revenue: nonNegativeAmount(operation.revenue),
    salesCount: nonNegativeSales(operation.salesCount),
  };
}

function nextRecurrenceRevision(previousRevision?: number): number {
  return Math.max(
    Date.now(),
    typeof previousRevision === "number" && Number.isFinite(previousRevision)
      ? previousRevision + 1
      : 0,
  );
}

function vibeSummaryToOps(
  summary: VibeBusinessSummary,
  userId: string,
): InfoproductOp[] {
  return summary.products.map((product) => ({
    id: `vibe:${summary.period.month}:${product.productId}`,
    userId,
    month: summary.period.month,
    productName: product.name,
    adSpend: product.spendGross,
    revenue: product.revenueReconciled,
    salesCount: product.sales,
    source: "VIBE",
    externalRef: `vibe:v1:${summary.period.month}:${product.productId}`,
    track: product.track,
    spendNet: product.spendNet,
    vatAmount: product.vatAmount,
    conversations: product.conversations,
    costPerConversation: product.costPerConversation,
    cpa: product.cpa,
    roas: product.roas,
    sourceStatus: summary.status,
  }));
}

interface Props {
  userId: string;
  ops: InfoproductOp[];
  fixedExpenses: InfoproductFixedExpense[];
  businessExpenses: Expense[];
  availableBusinessCash: number;
  cashConfigured?: boolean;
  cashNeedsReview?: boolean;
  productTestCost: number;
  onSaveBusinessConfig: (capital: number, testCost: number) => Promise<void>;
  onRefresh: () => void;
}

export default function InfoproductHealthCheck({
  userId,
  ops,
  fixedExpenses,
  businessExpenses,
  availableBusinessCash,
  cashConfigured = true,
  cashNeedsReview = false,
  productTestCost,
  onSaveBusinessConfig,
  onRefresh,
}: Props) {
  // ── View Mode & Date Selectors ──
  const now = new Date();
  const currentMonthKey = monthInMexicoCity(now);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [viewMode, setViewMode] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const vibeCacheRef = useRef(new Map<string, VibeCacheEntry>());
  const [, setVibeCacheVersion] = useState(0);
  const [vibeRefreshKey, setVibeRefreshKey] = useState(0);
  const lastVibeRefreshKeyRef = useRef(0);

  // ── Form Modals State ──
  const [opModalOpen, setOpModalOpen] = useState(false);
  const [fixedModalOpen, setFixedModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [editingFixedSeriesId, setEditingFixedSeriesId] = useState<string | null>(null);
  const [editingFixedRevision, setEditingFixedRevision] = useState<number | undefined>();

  // Op Form
  const [pName, setPName] = useState("");
  const [pAdSpend, setPAdSpend] = useState("");
  const [pRevenue, setPRevenue] = useState("");
  const [pSales, setPSales] = useState("");

  // Fixed Form
  const [fConcept, setFConcept] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fixedMutationPending, setFixedMutationPending] = useState(false);
  const fixedMutationPendingRef = useRef(false);

  // Capital Config Form
  const [capInput, setCapInput] = useState(availableBusinessCash.toString());
  const [testCostInput, setTestCostInput] = useState(productTestCost.toString());

  // Helper date formatting YYYY-MM to "Agosto 2026"
  const formatMonthLabel = (mKey: string) => {
    const [year, month] = mKey.split("-").map(Number);
    if (!year || !month) return mKey;
    const date = new Date(year, month - 1, 1);
    const monthName = date.toLocaleDateString("es-MX", { month: "long" });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  };

  const navigateMonth = (direction: -1 | 1) => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1 + direction, 1);
    const newKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(newKey);
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVibeRefreshKey((current) => current + 1);
    }, VIBE_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const vibeCache = vibeCacheRef.current;
    const desiredMonths = new Set<string>();

    // La posición global siempre usa el mes actual y los tres cierres previos.
    desiredMonths.add(currentMonthKey);
    for (let offset = -3; offset <= -1; offset += 1) {
      desiredMonths.add(addMonthsToMonthKey(currentMonthKey, offset));
    }

    // La navegación mensual nunca dispara consultas hacia meses futuros.
    if (selectedMonth <= currentMonthKey) desiredMonths.add(selectedMonth);

    // En anual se precargan únicamente meses YTD (o el año completo si ya cerró).
    if (viewMode === "ANNUAL") {
      for (let month = 1; month <= 12; month += 1) {
        const key = `${selectedYear}-${String(month).padStart(2, "0")}`;
        if (key <= currentMonthKey) desiredMonths.add(key);
      }
    }

    if (lastVibeRefreshKeyRef.current !== vibeRefreshKey) {
      // Refresh the complete decision window, not only the visible month. A
      // failed or provisional close must not stay frozen inside the runway.
      for (const month of desiredMonths) {
        const entry = vibeCache.get(month);
        if (
          month === currentMonthKey ||
          month === selectedMonth ||
          Boolean(entry?.error) ||
          !entry?.summary ||
          !isVibeBusinessSummaryComplete(entry.summary)
        ) {
          vibeCache.delete(month);
        }
      }
      lastVibeRefreshKeyRef.current = vibeRefreshKey;
    }

    const missingMonths = Array.from(desiredMonths).filter(
      (month) => !vibeCache.has(month),
    );
    if (missingMonths.length === 0) return;

    for (const month of missingMonths) {
      vibeCache.set(month, {
        summary: null,
        loading: true,
        error: "",
        fetchedAt: 0,
      });
    }
    setVibeCacheVersion((version) => version + 1);

    let nextMonthIndex = 0;
    const loadNextMonth = async () => {
      while (!controller.signal.aborted) {
        const month = missingMonths[nextMonthIndex];
        nextMonthIndex += 1;
        if (!month) return;

        try {
          const response = await fetch(
            `/api/integrations/vibe/summary?${new URLSearchParams({ month })}`,
            {
              cache: "no-store",
              credentials: "same-origin",
              signal: controller.signal,
            },
          );
          const body = (await response.json()) as
            | VibeBusinessSummary
            | { error?: { message?: string } };
          if (!response.ok) {
            const message =
              "error" in body && body.error?.message
                ? body.error.message
                : "No fue posible consultar Vibe";
            throw new Error(message);
          }
          const summary = body as VibeBusinessSummary;
          if (summary.period.month !== month) {
            throw new Error("Vibe devolvió un periodo distinto al solicitado");
          }
          vibeCache.set(month, {
            summary,
            loading: false,
            error: "",
            fetchedAt: Date.now(),
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          vibeCache.set(month, {
            summary: null,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "No fue posible consultar Vibe",
            fetchedAt: Date.now(),
          });
        } finally {
          if (!controller.signal.aborted) {
            setVibeCacheVersion((version) => version + 1);
          }
        }
      }
    };

    const workerCount = Math.min(4, missingMonths.length);
    void Promise.all(
      Array.from({ length: workerCount }, () => loadNextMonth()),
    );

    return () => {
      controller.abort();
      for (const month of missingMonths) {
        if (vibeCache.get(month)?.loading) {
          vibeCache.delete(month);
        }
      }
    };
  }, [currentMonthKey, selectedMonth, selectedYear, viewMode, vibeRefreshKey]);

  const selectedVibeEntry = vibeCacheRef.current.get(selectedMonth);
  const selectedVibePeriodMismatch = Boolean(
    selectedVibeEntry?.summary &&
      selectedVibeEntry.summary.period.month !== selectedMonth,
  );
  const vibeSummary = selectedVibePeriodMismatch
    ? null
    : selectedVibeEntry?.summary ?? null;
  const vibeLoading = selectedMonth <= currentMonthKey
    ? !selectedVibeEntry || selectedVibeEntry.loading
    : false;
  const vibeError = selectedVibePeriodMismatch
    ? "Vibe devolvió un periodo distinto al solicitado"
    : selectedVibeEntry?.error ?? "";

  // Vibe es la fuente canónica para pauta y ventas del mes cuando está
  // disponible. Los registros manuales se conservan como fallback, no se suman.
  const manualMonthOps = useMemo(() => {
    return ops
      .filter((o) => o.month === selectedMonth)
      .map(sanitizeOperation);
  }, [ops, selectedMonth]);

  const vibeMonthOps = useMemo<InfoproductOp[]>(() => {
    if (!vibeSummary || vibeSummary.period.month !== selectedMonth) return [];
    return vibeSummaryToOps(vibeSummary, userId);
  }, [selectedMonth, userId, vibeSummary]);

  const usingVibe = vibeMonthOps.length > 0 || Boolean(vibeSummary);
  const monthOps = usingVibe ? vibeMonthOps : manualMonthOps;
  const selectedVibeIncomplete = Boolean(
    vibeSummary && !isVibeBusinessSummaryComplete(vibeSummary),
  );
  const selectedDataIncomplete =
    selectedMonth <= currentMonthKey &&
    (selectedVibeIncomplete ||
      (!usingVibe &&
        manualMonthOps.length === 0 &&
        (vibeLoading || Boolean(vibeError))));

  const selectedFixedResolution = useMemo(
    () =>
      resolveCombinedBusinessFixedExpenses(
        fixedExpenses,
        businessExpenses,
        selectedMonth,
      ),
    [businessExpenses, fixedExpenses, selectedMonth],
  );
  const monthFixed = selectedFixedResolution.versioned;
  const monthBusinessFixed = selectedFixedResolution.general;
  const monthOtherOperatingExpenses = selectedFixedResolution.periodOnly;

  // ── Monthly Calculations ──
  const totalRevenue = useMemo(() => {
    return monthOps.reduce((sum, o) => sum + (o.revenue || 0), 0);
  }, [monthOps]);

  const totalAdSpend = useMemo(() => {
    return monthOps.reduce((sum, o) => sum + (o.adSpend || 0), 0);
  }, [monthOps]);

  const totalFixedExpenses = useMemo(() => {
    const healthCheckFixed = monthFixed.reduce(
      (sum, expense) => sum + nonNegativeAmount(expense.amount),
      0,
    );
    const generalLedgerFixed = monthBusinessFixed.reduce(
      (sum, expense) => sum + nonNegativeAmount(expense.amount),
      0,
    );
    return healthCheckFixed + generalLedgerFixed;
  }, [monthBusinessFixed, monthFixed]);

  const totalOtherOperatingExpenses = useMemo(
    () =>
      monthOtherOperatingExpenses.reduce(
        (sum, expense) => sum + nonNegativeAmount(expense.amount),
        0,
      ),
    [monthOtherOperatingExpenses],
  );

  const totalKnownOperatingExpenses =
    totalFixedExpenses + totalOtherOperatingExpenses;
  const totalExpenses = totalAdSpend + totalKnownOperatingExpenses;
  const netResult = totalRevenue - totalExpenses;
  const contributionMargin = totalRevenue - totalAdSpend;
  const contributionMarginRatio = totalRevenue > 0 ? contributionMargin / totalRevenue : 0;

  // Break-even Revenue (Punto de Equilibrio)
  const breakEvenRevenue =
    contributionMarginRatio > 0
      ? totalKnownOperatingExpenses / contributionMarginRatio
      : null;

  const breakEvenDiff =
    breakEvenRevenue !== null ? breakEvenRevenue - totalRevenue : null;

  // ── Month-End Projection ──
  const [projYear, projMonthNum] = selectedMonth.split("-").map(Number);
  const totalDaysInMonth = new Date(projYear, projMonthNum, 0).getDate();
  const isCurrentMonthSelected = selectedMonth === currentMonthKey;
  const todayInMexicoCity = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Mexico_City",
      day: "numeric",
    }).format(now),
  );
  const currentDayPassed = isCurrentMonthSelected
    ? Math.min(todayInMexicoCity, totalDaysInMonth)
    : totalDaysInMonth;

  const dailyRevenueRate = currentDayPassed > 0 ? totalRevenue / currentDayPassed : 0;
  const dailyAdSpendRate = currentDayPassed > 0 ? totalAdSpend / currentDayPassed : 0;

  const projectedClosingRevenue = dailyRevenueRate * totalDaysInMonth;
  const projectedClosingAdSpend = dailyAdSpendRate * totalDaysInMonth;
  const projectedClosingResult =
    projectedClosingRevenue -
    projectedClosingAdSpend -
    totalKnownOperatingExpenses;

  // ── Monthly Health Status ──
  const health = classifyBusinessHealth({
    totalRevenue,
    totalAdSpend,
    netResult,
    projectedClosingResult,
  });
  const healthStatus = selectedDataIncomplete ? "ATENCION" : health.status;
  let healthMessage = "";
  let healthSub = "";

  if (selectedDataIncomplete) {
    if (vibeLoading) {
      healthMessage =
        "Estamos completando los datos del periodo antes de diagnosticarlo.";
      healthSub =
        "El health check se actualizará automáticamente al terminar la consulta.";
    } else if (selectedVibeIncomplete) {
      healthMessage =
        "El periodo tiene datos provisionales o fuentes incompletas.";
      healthSub =
        "Las cifras se muestran como estimación, pero no alimentan un cierre confirmado ni el runway.";
    } else {
      healthMessage =
        "No pudimos confirmar la operación de este periodo con Vibe.";
      healthSub =
        "Los gastos fijos siguen visibles, pero no se marcará el mes como pérdida confirmada hasta contar con Vibe o un registro manual.";
    }
  } else if (health.reason === "NO_OPERATION") {
    healthMessage = totalKnownOperatingExpenses > 0
      ? "No hay operación registrada y los gastos conocidos ya están consumiendo capital."
      : "Aún no hay operación suficiente para evaluar la salud del negocio.";
    healthSub = totalKnownOperatingExpenses > 0
      ? `El resultado del mes es -${formatCurrency(Math.abs(netResult))}; registra ingresos o pauta antes de considerar el periodo saludable.`
      : "Registra ingresos o gasto de operación para generar un diagnóstico financiero.";
  } else if (health.reason === "NEGATIVE_CONTRIBUTION") {
    healthMessage = "No escales todavía. Actualmente estás gastando más para generar cada peso de ingreso.";
    healthSub = "La operación del producto tiene un margen de contribución negativo o en cero.";
  } else if (health.reason === "NEGATIVE_RESULT") {
    healthMessage = "Tu operación deja margen, pero el resultado todavía no es positivo.";
    healthSub = projectedClosingResult < 0
      ? `Al ritmo actual, el cierre proyectado sería de ${formatCurrency(projectedClosingResult)}. Ajusta ventas, pauta o gastos antes de escalar.`
      : `Aún te faltan ${formatCurrency(Math.max(0, breakEvenDiff || 0))} para cubrir el punto de equilibrio del mes.`;
  } else {
    healthMessage = "Vas bien. La operación es rentable y estás en camino de cubrir el mes.";
    healthSub = "Tus ingresos ya superaron los gastos fijos y de operación. ¡El negocio está en utilidad!";
  }

  const operationsForMonth = (month: string) => {
    const entry = vibeCacheRef.current.get(month);
    const summary =
      entry?.summary?.period.month === month ? entry.summary : null;
    if (summary) {
      return {
        operations: vibeSummaryToOps(summary, userId),
        source: "VIBE" as const,
        sourceStatus: summary.status,
        sourceComplete: isVibeBusinessSummaryComplete(summary),
        loading: false,
        error: "",
      };
    }
    const manualOperations = ops
      .filter((operation) => operation.month === month)
      .map(sanitizeOperation);
    return {
      operations: manualOperations,
      source: "MANUAL" as const,
      sourceStatus: null,
      sourceComplete: manualOperations.length > 0,
      loading: month <= currentMonthKey ? !entry || entry.loading : false,
      error: entry?.error ?? "",
    };
  };

  const combinedFixedExpensesForMonth = (month: string) =>
    resolveCombinedBusinessFixedExpenses(
      fixedExpenses,
      businessExpenses,
      month,
    );

  // ── GLOBAL BUSINESS POSITION ──
  // Esta sección sólo depende de la caja declarada, los cierres reales más
  // recientes y el mes actual; nunca del periodo que el usuario está viendo.
  const closedMonthKeys = [-3, -2, -1].map((offset) =>
    addMonthsToMonthKey(currentMonthKey, offset),
  );
  const closedBusinessResults = closedMonthKeys.map((month) => {
    const bundle = operationsForMonth(month);
    const fixedResolution = combinedFixedExpensesForMonth(month);
    const recurringFixed = fixedResolution.versioned;
    const generalFixed = fixedResolution.general;
    const periodOnly = fixedResolution.periodOnly;
    const revenue = bundle.operations.reduce(
      (sum, operation) => sum + (operation.revenue || 0),
      0,
    );
    const spend = bundle.operations.reduce(
      (sum, operation) => sum + (operation.adSpend || 0),
      0,
    );
    const fixed = recurringFixed.reduce(
      (sum, expense) => sum + nonNegativeAmount(expense.amount),
      0,
    ) + generalFixed.reduce(
      (sum, expense) => sum + nonNegativeAmount(expense.amount),
      0,
    );
    const other = periodOnly.reduce(
      (sum, expense) => sum + nonNegativeAmount(expense.amount),
      0,
    );
    const hasOperation = revenue > 0 || spend > 0;
    return {
      month,
      netResult: revenue - spend - fixed - other,
      hasData:
        bundle.sourceComplete && (hasOperation || fixed > 0 || other > 0),
    };
  });

  const currentMonthBundle = operationsForMonth(currentMonthKey);
  const currentFixedResolution =
    combinedFixedExpensesForMonth(currentMonthKey);
  const currentRecurringFixed = currentFixedResolution.versioned;
  const currentGeneralFixed = currentFixedResolution.general;
  const currentPeriodOnly = currentFixedResolution.periodOnly;
  const currentFixedCommitment = currentRecurringFixed.reduce(
    (sum, expense) => sum + nonNegativeAmount(expense.amount),
    0,
  ) + currentGeneralFixed.reduce(
    (sum, expense) => sum + nonNegativeAmount(expense.amount),
    0,
  );
  const currentOtherOperatingExpenses = currentPeriodOnly.reduce(
    (sum, expense) => sum + nonNegativeAmount(expense.amount),
    0,
  );
  const currentRevenue = currentMonthBundle.operations.reduce(
    (sum, operation) => sum + (operation.revenue || 0),
    0,
  );
  const currentSpend = currentMonthBundle.operations.reduce(
    (sum, operation) => sum + (operation.adSpend || 0),
    0,
  );
  const [currentYearNumber, currentMonthNumber] = currentMonthKey
    .split("-")
    .map(Number);
  const currentMonthDays = new Date(
    currentYearNumber,
    currentMonthNumber,
    0,
  ).getDate();
  const currentRevenueProjection =
    (currentRevenue / Math.max(1, todayInMexicoCity)) * currentMonthDays;
  const currentSpendProjection =
    (currentSpend / Math.max(1, todayInMexicoCity)) * currentMonthDays;
  const currentProjection = {
    month: currentMonthKey,
    netResult:
      currentRevenueProjection -
      currentSpendProjection -
      currentFixedCommitment -
      currentOtherOperatingExpenses,
    hasData:
      currentMonthBundle.sourceComplete &&
      (currentRevenue > 0 ||
        currentSpend > 0 ||
        currentFixedCommitment > 0 ||
        currentOtherOperatingExpenses > 0),
  };
  const businessPosition = calculateBusinessPosition({
    availableCash: availableBusinessCash,
    cashConfigured,
    closedMonths: closedBusinessResults,
    currentProjection,
    currentFixedCommitment,
    productTestCost,
  });
  const globalDataLoading = [currentMonthKey, ...closedMonthKeys].some(
    (month) => {
      const entry = vibeCacheRef.current.get(month);
      return !entry || entry.loading;
    },
  );
  const globalDataErrors = [currentMonthKey, ...closedMonthKeys].filter(
    (month) => Boolean(vibeCacheRef.current.get(month)?.error),
  );
  const globalIncompletePeriods = [currentMonthKey, ...closedMonthKeys].filter(
    (month) => {
      const summary = vibeCacheRef.current.get(month)?.summary;
      return Boolean(summary && !isVibeBusinessSummaryComplete(summary));
    },
  );
  const businessPositionTone =
    businessPosition.status === "CRITICAL"
      ? "text-red-400"
      : businessPosition.status === "ATTENTION"
        ? "text-amber-400"
        : businessPosition.status === "HEALTHY" ||
            businessPosition.status === "SUSTAINABLE"
          ? "text-emerald-400"
          : "text-zinc-300";
  const burnSourceLabel =
    businessPosition.burnSource === "TRAILING_AVERAGE"
      ? `Promedio de ${businessPosition.sampleMonths} cierre${businessPosition.sampleMonths === 1 ? "" : "s"}`
      : businessPosition.burnSource === "CURRENT_PROJECTION"
        ? "Proyección del mes actual"
        : businessPosition.burnSource === "FIXED_COMMITMENT"
          ? "Compromiso fijo mensual"
          : "Sin datos suficientes";
  const businessPositionStatusLabel =
    businessPosition.status === "CRITICAL"
      ? "Crítico"
      : businessPosition.status === "ATTENTION"
        ? "Atención"
        : businessPosition.status === "HEALTHY"
          ? "Saludable"
          : businessPosition.status === "SUSTAINABLE"
            ? "Sostenible"
            : "Sin diagnóstico";
  const fixedCoverage =
    totalFixedExpenses > 0
      ? Math.max(0, contributionMargin) / totalFixedExpenses
      : null;

  // ── ANNUAL CALCULATIONS ──
  const annualMonthsGrid = Array.from({ length: 12 }, (_, index) => {
    const monthNum = String(index + 1).padStart(2, "0");
    const key = `${selectedYear}-${monthNum}`;
    const bundle = operationsForMonth(key);
    const fixedResolution = combinedFixedExpensesForMonth(key);
    const recurringFixed = fixedResolution.versioned;
    const generalFixed = fixedResolution.general;
    const periodOnly = fixedResolution.periodOnly;
    const rev = bundle.operations.reduce(
      (sum, operation) => sum + (operation.revenue || 0),
      0,
    );
    const ad = bundle.operations.reduce(
      (sum, operation) => sum + (operation.adSpend || 0),
      0,
    );
    const fix = recurringFixed.reduce(
      (sum, expense) => sum + nonNegativeAmount(expense.amount),
      0,
    ) + generalFixed.reduce(
      (sum, expense) => sum + nonNegativeAmount(expense.amount),
      0,
    );
    const other = periodOnly.reduce(
      (sum, expense) => sum + nonNegativeAmount(expense.amount),
      0,
    );
    const net = rev - ad - fix - other;
    const margin = rev - ad;
    const isFuture = key > currentMonthKey;
    const hasOperation = rev > 0 || ad > 0 || bundle.operations.length > 0;
    const hasData =
      bundle.sourceComplete && (hasOperation || fix > 0 || other > 0);
    const incomplete =
      !isFuture &&
      !bundle.sourceComplete &&
      (bundle.loading || Boolean(bundle.error) || Boolean(bundle.sourceStatus));
    const diagnosed = classifyBusinessHealth({
      totalRevenue: rev,
      totalAdSpend: ad,
      netResult: net,
      projectedClosingResult: net,
    });
    const status:
      | "BIEN"
      | "ATENCION"
      | "MAL"
      | "EMPTY"
      | "PLANNED"
      | "INCOMPLETE" = isFuture
      ? "PLANNED"
      : incomplete
        ? "INCOMPLETE"
        : hasData
          ? diagnosed.status
          : "EMPTY";
    const monthShort = new Date(selectedYear, index, 1)
      .toLocaleDateString("es-MX", { month: "short" })
      .toUpperCase();

    return {
      key,
      monthName: monthShort,
      operations: bundle.operations,
      source: bundle.source,
      sourceStatus: bundle.sourceStatus,
      sourceComplete: bundle.sourceComplete,
      loading: bundle.loading,
      error: bundle.error,
      rev,
      ad,
      fix,
      other,
      net,
      margin,
      roas: ad > 0 ? rev / ad : rev > 0 ? 999 : 0,
      status,
      isFuture,
    };
  });

  const annualYtdMonths = annualMonthsGrid.filter((month) => !month.isFuture);
  const annualIncompleteMonths = annualYtdMonths.filter(
    (month) => month.status === "INCOMPLETE",
  );
  const annualYtdOps = annualYtdMonths.flatMap((month) => month.operations);
  const annualRevenue = annualYtdMonths.reduce((sum, month) => sum + month.rev, 0);
  const annualAdSpend = annualYtdMonths.reduce((sum, month) => sum + month.ad, 0);
  const annualFixedExpenses = annualYtdMonths.reduce(
    (sum, month) => sum + month.fix,
    0,
  );
  const annualOtherOperatingExpenses = annualYtdMonths.reduce(
    (sum, month) => sum + month.other,
    0,
  );
  const annualTotalExpenses =
    annualAdSpend + annualFixedExpenses + annualOtherOperatingExpenses;
  const annualNetResult = annualRevenue - annualTotalExpenses;
  const annualROAS =
    annualAdSpend > 0 ? annualRevenue / annualAdSpend : annualRevenue > 0 ? 999 : 0;
  const annualContributionMargin = annualRevenue - annualAdSpend;
  const annualContributionMarginRatio =
    annualRevenue > 0 ? annualContributionMargin / annualRevenue : 0;
  const annualBreakEven =
    annualContributionMarginRatio > 0
      ? (annualFixedExpenses + annualOtherOperatingExpenses) /
        annualContributionMarginRatio
      : null;
  const annualPeriodLabel =
    selectedYear < currentYearNumber
      ? `cierre ${selectedYear}`
      : selectedYear === currentYearNumber
        ? `YTD a ${formatMonthLabel(currentMonthKey)}`
        : "sin meses transcurridos";

  // Aggregated Product Summaries for elapsed months of selectedYear.
  const annualProductSummaries = (() => {
    const map = new Map<string, { adSpend: number; revenue: number; sales: number }>();
    annualYtdOps.forEach((op) => {
      const name = op.productName.trim();
      const curr = map.get(name) || { adSpend: 0, revenue: 0, sales: 0 };
      curr.adSpend += op.adSpend || 0;
      curr.revenue += op.revenue || 0;
      curr.sales += op.salesCount || 0;
      map.set(name, curr);
    });

    return Array.from(map.entries()).map(([productName, data]) => {
      const profit = data.revenue - data.adSpend;
      const roas = data.adSpend > 0 ? data.revenue / data.adSpend : data.revenue > 0 ? 999 : 0;
      const cpa = data.sales > 0 ? data.adSpend / data.sales : null;
      const marginPct = data.revenue > 0 ? ((data.revenue - data.adSpend) / data.revenue) * 100 : 0;
      return { productName, ...data, profit, roas, cpa, marginPct };
    });
  })();

  // ── Handlers ──
  const handleOpenOpModal = (op?: InfoproductOp) => {
    if (op) {
      setEditingOpId(op.id);
      setPName(op.productName);
      setPAdSpend(op.adSpend.toString());
      setPRevenue(op.revenue.toString());
      setPSales(op.salesCount?.toString() || "");
    } else {
      setEditingOpId(null);
      setPName("");
      setPAdSpend("");
      setPRevenue("");
      setPSales("");
    }
    setOpModalOpen(true);
  };

  const handleSaveOp = async () => {
    if (!userId || !pName.trim()) return;
    const adSpend = pAdSpend.trim() ? Number(pAdSpend) : 0;
    const revenue = pRevenue.trim() ? Number(pRevenue) : 0;
    const salesCount = pSales.trim() ? Number(pSales) : undefined;
    const validMoney = (value: number) => {
      const cents = value * 100;
      const tolerance = Number.EPSILON * Math.max(1, Math.abs(cents)) * 4;
      return (
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100_000_000 &&
        Math.abs(cents - Math.round(cents)) <= tolerance
      );
    };
    if (
      !validMoney(adSpend) ||
      !validMoney(revenue) ||
      (salesCount !== undefined &&
        (!Number.isSafeInteger(salesCount) ||
          salesCount < 0 ||
          salesCount > 100_000_000))
    ) {
      window.alert(
        "Usa importes no negativos con máximo dos decimales y ventas enteras no negativas.",
      );
      return;
    }
    const payload = {
      month: selectedMonth,
      productName: pName.trim(),
      adSpend,
      revenue,
      salesCount,
    };

    if (editingOpId) {
      await updateFinance(userId, "infoproduct_ops", editingOpId, payload);
    } else {
      await createFinance(userId, "infoproduct_ops", payload);
    }
    setOpModalOpen(false);
    onRefresh();
  };

  const handleDeleteOp = async (id: string) => {
    if (!userId) return;
    await removeFinance(userId, "infoproduct_ops", id);
    onRefresh();
  };

  const handleOpenFixedModal = (fix?: InfoproductFixedExpense) => {
    if (fix) {
      if (selectedMonth !== currentMonthKey) {
        window.alert(
          "Los gastos vigentes solo se pueden editar desde el mes actual para conservar los cierres históricos.",
        );
        return;
      }
      setEditingFixedSeriesId(recurringFixedSeriesId(fix));
      setEditingFixedRevision(fix.revision);
      setFConcept(fix.concept);
      setFAmount(fix.amount.toString());
    } else {
      setEditingFixedSeriesId(null);
      setEditingFixedRevision(undefined);
      setFConcept("");
      setFAmount("");
    }
    setFixedModalOpen(true);
  };

  const handleSaveFixed = async () => {
    const amount = Number(fAmount);
    const normalizedConcept = normalizeConcept(fConcept);
    const identitySeenHistorically = fixedExpenses.some(
      (expense) => normalizeConcept(expense.concept) === normalizedConcept,
    );
    const conflictingActiveConcept = resolveRecurringFixedExpenses(
      fixedExpenses,
      currentMonthKey,
    ).some(
      (expense) =>
        normalizeConcept(expense.concept) === normalizedConcept &&
        recurringFixedSeriesId(expense) !== editingFixedSeriesId,
    );
    if (
      !userId ||
      !fConcept.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      fixedMutationPendingRef.current
    ) {
      return;
    }
    if (
      selectedMonth > currentMonthKey ||
      ((editingFixedSeriesId || identitySeenHistorically) &&
        selectedMonth !== currentMonthKey)
    ) {
      window.alert(
        "Una modificación recurrente solo puede iniciar en el mes actual.",
      );
      return;
    }
    if (conflictingActiveConcept) {
      window.alert(
        "Ya existe un gasto fijo vigente con ese concepto. Edita la serie actual para evitar duplicarla.",
      );
      return;
    }
    fixedMutationPendingRef.current = true;
    setFixedMutationPending(true);
    const revision = nextRecurrenceRevision(editingFixedRevision);
    const seriesId =
      editingFixedSeriesId ||
      (identitySeenHistorically
        ? `fixed:${revision}:${normalizedConcept}`
        : `legacy:${normalizedConcept}`);
    const payload = {
      month: selectedMonth,
      effectiveFrom: selectedMonth,
      seriesId,
      status: "ACTIVE" as const,
      revision,
      concept: fConcept.trim(),
      amount,
    };

    // Cada cambio genera una nueva versión efectiva desde el mes elegido. Así
    // una edición actual no reescribe los cierres históricos.
    try {
      await createInfoproductFixedExpenseVersion(
        userId,
        payload,
        editingFixedRevision || 0,
        {
          existingSeries: Boolean(editingFixedSeriesId),
          identitySeenHistorically,
          currentMonth: currentMonthKey,
        },
      );
      setFixedModalOpen(false);
      onRefresh();
    } catch (error) {
      if (error instanceof FinanceRecurrenceConflictError) {
        window.alert(
          "Este gasto cambió en otra operación o intentó modificar un cierre histórico. Recargamos los datos para que revises la versión vigente.",
        );
        onRefresh();
        return;
      }
      throw error;
    } finally {
      fixedMutationPendingRef.current = false;
      setFixedMutationPending(false);
    }
  };

  const handleCancelFixed = async (fix: InfoproductFixedExpense) => {
    if (!userId || fixedMutationPendingRef.current) return;
    if (selectedMonth !== currentMonthKey) {
      window.alert(
        "Los gastos vigentes solo se pueden detener desde el mes actual para conservar los cierres históricos.",
      );
      return;
    }
    const confirmed = window.confirm(
      `¿Detener “${fix.concept}” desde ${formatMonthLabel(selectedMonth)}? Los meses anteriores conservarán su historial.`,
    );
    if (!confirmed) return;

    fixedMutationPendingRef.current = true;
    setFixedMutationPending(true);
    try {
      await createInfoproductFixedExpenseVersion(
        userId,
        {
          month: currentMonthKey,
          effectiveFrom: currentMonthKey,
          seriesId: recurringFixedSeriesId(fix),
          status: "CANCELLED" as const,
          revision: nextRecurrenceRevision(fix.revision),
          concept: fix.concept,
          amount: 0,
        },
        fix.revision || 0,
        { existingSeries: true, currentMonth: currentMonthKey },
      );
      onRefresh();
    } catch (error) {
      if (error instanceof FinanceRecurrenceConflictError) {
        window.alert(
          "Este gasto cambió en otra operación. Recargamos los datos para que revises la versión vigente.",
        );
        onRefresh();
        return;
      }
      throw error;
    } finally {
      fixedMutationPendingRef.current = false;
      setFixedMutationPending(false);
    }
  };

  const handleOpenConfigModal = () => {
    setCapInput(availableBusinessCash.toString());
    setTestCostInput(productTestCost.toString());
    setConfigModalOpen(true);
  };

  const handleSaveConfig = async () => {
    const parsedCash = Number(capInput);
    const parsedTestCost = Number(testCostInput);
    const cap = Number.isFinite(parsedCash) ? parsedCash : 0;
    const tCost =
      Number.isFinite(parsedTestCost) && parsedTestCost > 0
        ? parsedTestCost
        : 1000;
    await onSaveBusinessConfig(cap, tCost);
    setConfigModalOpen(false);
    onRefresh();
  };

  return (
    <div className="space-y-8">

      {/* ── 1. HEADER: VIEW MODE TOGGLE & DATE SELECTORS ── */}
      <div className="glass-card p-6 bg-[#0c0c0e]/95 border border-white/[0.06] rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">

        {/* Title & Mode Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 shadow-lg">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-white">
                Dashboard de Negocio {viewMode === "MONTHLY" ? "— Mensual" : "— Anual"}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {viewMode === "MONTHLY" ? `Análisis en tiempo real de ${formatMonthLabel(selectedMonth)}` : `Rendimiento acumulado del año ${selectedYear}`}
              </p>
            </div>
          </div>

          {/* Toggle [ Mensual ] [ Anual ] */}
          <div className="flex items-center gap-1 bg-black/60 p-1.5 border border-white/10 rounded-2xl shrink-0">
            <button
              onClick={() => setViewMode("MONTHLY")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5",
                viewMode === "MONTHLY"
                  ? "bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              Mensual
            </button>
            <button
              onClick={() => setViewMode("ANNUAL")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5",
                viewMode === "ANNUAL"
                  ? "bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Grid className="w-3.5 h-3.5" />
              Anual
            </button>
          </div>
        </div>

        {/* Date Selector & Action Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <button
            onClick={handleOpenConfigModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-white/[0.03] border border-white/[0.08] text-zinc-300 hover:text-amber-400 hover:border-amber-500/30 transition-all"
          >
            <Settings className="w-4 h-4" />
            Configurar Caja
          </button>

          {viewMode === "MONTHLY" ? (
            <div className="flex items-center gap-2 bg-black/60 p-1.5 border border-white/10 rounded-2xl">
              <button
                onClick={() => navigateMonth(-1)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-3 py-1 font-mono text-sm font-black text-amber-400 min-w-[140px] text-center">
                {formatMonthLabel(selectedMonth)}
              </div>

              <button
                onClick={() => navigateMonth(1)}
                disabled={selectedMonth >= currentMonthKey}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-black/60 p-1.5 border border-white/10 rounded-2xl">
              <button
                onClick={() => setSelectedYear(selectedYear - 1)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Año anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-3 py-1 font-mono text-sm font-black text-amber-400 min-w-[80px] text-center">
                {selectedYear}
              </div>

              <button
                onClick={() => setSelectedYear(selectedYear + 1)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Año siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── POSICIÓN GLOBAL: INDEPENDIENTE DEL PERIODO SELECCIONADO ── */}
      <section className="glass-card bg-gradient-to-br from-[#111114] via-[#0c0c0e] to-blue-950/10 border border-blue-500/15 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Wallet className="w-4.5 h-4.5 text-blue-400" /> Posición Global del Negocio
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Una sola caja y un solo runway, sin importar qué mes estés consultando.
            </p>
          </div>
          <span
            className={cn(
              "self-start rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider",
              businessPositionTone,
            )}
          >
            {!cashConfigured
              ? "Configura caja"
              : globalDataLoading
              ? "Actualizando datos"
              : `${businessPositionStatusLabel}${globalDataErrors.length > 0 || globalIncompletePeriods.length > 0 ? " · parcial" : ""}`}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Caja disponible hoy</p>
            <p className={cn("font-mono text-xl font-black", !cashConfigured ? "text-zinc-300" : availableBusinessCash >= 0 ? "text-emerald-400" : "text-red-400")}>
              {cashConfigured ? formatCurrency(availableBusinessCash) : "Sin configurar"}
            </p>
            <p className="text-[10px] text-zinc-500">Saldo líquido declarado</p>
          </div>

          <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Runway general</p>
            <p className={cn("font-mono text-xl font-black", businessPositionTone)}>
              {!cashConfigured
                ? "Configura caja"
                : businessPosition.runwayMonths !== null
                ? `${businessPosition.runwayMonths.toFixed(1)} meses`
                : businessPosition.monthlyBurn === 0
                  ? "Sostenible"
                  : "Sin base"}
            </p>
            <p className="text-[10px] text-zinc-500">{burnSourceLabel}</p>
          </div>

          <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.04] p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Burn mensual</p>
            <p className="font-mono text-xl font-black text-red-400">
              {businessPosition.monthlyBurn === null
                ? "—"
                : businessPosition.monthlyBurn === 0
                  ? "$0"
                  : `-${formatCurrency(businessPosition.monthlyBurn)}`}
            </p>
            <p className="text-[10px] text-zinc-500">Base usada por el runway</p>
          </div>

          <div className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Compromiso fijo</p>
            <p className="font-mono text-xl font-black text-violet-400">
              {formatCurrency(currentFixedCommitment)}
            </p>
            <p className="text-[10px] text-zinc-500">Recurrente cada mes</p>
          </div>

          <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Capacidad de test</p>
            <p className="font-mono text-xl font-black text-amber-400">
              {cashConfigured
                ? `${businessPosition.possibleTests} producto${businessPosition.possibleTests === 1 ? "" : "s"}`
                : "—"}
            </p>
            <p className="text-[10px] text-zinc-500">
              Tras reservar 3 meses de fijos ({formatCurrency(businessPosition.reserveAmount)})
            </p>
          </div>
        </div>

        {!cashConfigured && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-[11px] leading-relaxed text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Configura tu saldo líquido actual para calcular runway y capacidad de pruebas. Un valor sin configurar no se interpreta como caja agotada.
            </p>
          </div>
        )}

        {cashConfigured && cashNeedsReview && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-[11px] leading-relaxed text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              La caja mostrada fue heredada del antiguo “capital base”. Confirma el saldo líquido actual en <strong>Configurar Caja</strong> para que el runway sea preciso.
            </p>
          </div>
        )}

        {globalDataErrors.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-[11px] leading-relaxed text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Vibe no respondió para {globalDataErrors.length} periodo{globalDataErrors.length === 1 ? "" : "s"} del cálculo. Se usaron registros manuales disponibles y se excluyeron cierres sin una fuente confirmada.
            </p>
          </div>
        )}

        {globalIncompletePeriods.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-[11px] leading-relaxed text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {globalIncompletePeriods.length} periodo{globalIncompletePeriods.length === 1 ? "" : "s"} de Vibe sigue{globalIncompletePeriods.length === 1 ? "" : "n"} provisional{globalIncompletePeriods.length === 1 ? "" : "es"} o con fuentes incompletas. Sus cifras quedan visibles como estimación, pero se excluyen de los cierres usados por el runway.
            </p>
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-zinc-500">
          Runway = caja disponible ÷ burn mensual. La base toma el escenario más conservador entre hasta 3 cierres Vibe finalizados y completos, la proyección actual confirmada y el compromiso fijo mensual. El registro manual funciona como respaldo cuando Vibe no está disponible.
        </p>
      </section>

      {/* ════════════════════════════════════════════════
          MODE A: MONTHLY DASHBOARD VIEW
      ════════════════════════════════════════════════ */}
      {viewMode === "MONTHLY" && (
        <>
          <VibeBusinessSnapshotCard
            summary={vibeSummary}
            loading={vibeLoading}
            error={vibeError}
            onRetry={() => setVibeRefreshKey((current) => current + 1)}
          />

          {/* ── 2. MÉTRICAS ACCIONABLES DEL MES ── */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="glass-card p-6 bg-[#0c0c0e]/90 border border-emerald-500/15 rounded-3xl flex flex-col justify-between space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Ingresos del Mes</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight">{formatCurrency(totalRevenue)}</p>
                  <p className="text-[11px] text-zinc-500 font-mono mt-1">{monthOps.length} producto{monthOps.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              <div className="glass-card p-6 bg-[#0c0c0e]/90 border border-red-500/15 rounded-3xl flex flex-col justify-between space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Pauta / Operación</span>
                  <TrendingDown className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-black text-red-400 font-mono tracking-tight">{formatCurrency(totalAdSpend)}</p>
                  <p className="text-[11px] text-zinc-500 font-mono mt-1">Margen: {formatCurrency(contributionMargin)}</p>
                </div>
              </div>

              <div className="glass-card p-6 bg-[#0c0c0e]/90 border border-blue-500/15 rounded-3xl flex flex-col justify-between space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Fijos Recurrentes</span>
                  <Layers className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-black text-blue-400 font-mono tracking-tight">{formatCurrency(totalFixedExpenses)}</p>
                  <p className="text-[11px] text-zinc-500 font-mono mt-1">
                    {monthFixed.length + monthBusinessFixed.length} compromiso{monthFixed.length + monthBusinessFixed.length === 1 ? "" : "s"} activo{monthFixed.length + monthBusinessFixed.length === 1 ? "" : "s"}
                    {totalOtherOperatingExpenses > 0
                      ? ` · Otros del periodo: ${formatCurrency(totalOtherOperatingExpenses)}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className={cn("glass-card p-6 bg-[#0c0c0e]/90 rounded-3xl flex flex-col justify-between space-y-3 shadow-xl border", netResult >= 0 ? "border-emerald-500/20" : "border-red-500/20")}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Resultado del Mes</span>
                  {netResult >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                </div>
                <div>
                  <p className={cn("text-xl sm:text-2xl font-black font-mono tracking-tight", netResult >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {netResult >= 0 ? `+${formatCurrency(netResult)}` : formatCurrency(netResult)}
                  </p>
                  <p className="text-[11px] text-zinc-500 font-mono mt-1">Ingresos − pauta − gastos conocidos</p>
                </div>
              </div>

              <div className="glass-card p-6 bg-[#0c0c0e]/90 border border-amber-500/15 rounded-3xl flex flex-col justify-between space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Cobertura Fija</span>
                  <Target className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className={cn("text-xl sm:text-2xl font-black font-mono tracking-tight", fixedCoverage === null || fixedCoverage >= 1 ? "text-emerald-400" : "text-amber-400")}>
                    {fixedCoverage === null ? "Sin fijos" : `${(fixedCoverage * 100).toFixed(0)}%`}
                  </p>
                  <p className="text-[11px] text-zinc-500 font-mono mt-1">
                    {breakEvenRevenue === null
                      ? "Margen insuficiente para PE"
                      : Math.max(0, breakEvenDiff || 0) === 0
                        ? "Punto de equilibrio cubierto"
                        : `Brecha PE: ${formatCurrency(Math.max(0, breakEvenDiff || 0))}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-zinc-500">
              <span>
                Confianza del periodo:{" "}
                {usingVibe
                  ? `Vibe ${vibeSummary?.status === "FINAL" ? "final" : "provisional"}`
                  : manualMonthOps.length > 0
                    ? `registro manual${vibeError ? " · Vibe no disponible" : ""}`
                    : selectedDataIncomplete
                      ? vibeLoading
                        ? "consultando Vibe"
                        : "datos incompletos"
                      : "sin operación registrada"}
              </span>
              <span>Los fijos se resuelven por vigencia recurrente.</span>
            </div>
          </div>

          {/* ── 3. ESTADO HEALTH CHECK ── */}
          <div
            className={cn(
              "p-7 sm:p-8 rounded-3xl border transition-all duration-300 relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6",
              healthStatus === "BIEN"
                ? "bg-gradient-to-br from-emerald-950/40 via-[#0c0c0e] to-emerald-900/10 border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.08)]"
                : healthStatus === "ATENCION"
                ? "bg-gradient-to-br from-amber-950/40 via-[#0c0c0e] to-amber-900/10 border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.08)]"
                : "bg-gradient-to-br from-red-950/40 via-[#0c0c0e] to-red-900/10 border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.08)]"
            )}
          >
            <div className="flex items-start gap-5 flex-1">
              <div
                className={cn(
                  "w-16 h-16 rounded-2xl border flex items-center justify-center shrink-0 shadow-xl text-3xl font-black",
                  healthStatus === "BIEN"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10"
                    : healthStatus === "ATENCION"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-amber-500/10"
                    : "bg-red-500/20 text-red-400 border-red-500/30 shadow-red-500/10"
                )}
              >
                {healthStatus === "BIEN" ? "🟢" : healthStatus === "ATENCION" ? "🟡" : "🔴"}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-xs font-black uppercase tracking-widest px-3 py-1 rounded-lg border",
                      healthStatus === "BIEN"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : healthStatus === "ATENCION"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    )}
                  >
                    ESTADO: {healthStatus === "BIEN" ? "BIEN" : healthStatus === "ATENCION" ? "ATENCIÓN" : "MAL"}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">Health Check Operativo</span>
                </div>

                <h3 className="text-lg sm:text-xl font-black text-white leading-tight">
                  &ldquo;{healthMessage}&rdquo;
                </h3>
                <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
                  {healthSub}
                </p>
              </div>
            </div>
          </div>

          {/* ── 4. PUNTO DE EQUILIBRIO & PROYECCIÓN AL CIERRE ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Punto de Equilibrio */}
            <div className="glass-card p-6 sm:p-7 bg-[#0c0c0e]/80 border border-white/[0.06] rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Target className="w-4.5 h-4.5 text-amber-400" /> Punto de Equilibrio
                </h4>
                <span className="text-[11px] text-zinc-500 font-mono">Margen Contribución: {(contributionMarginRatio * 100).toFixed(0)}%</span>
              </div>

              {breakEvenRevenue === null ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                  <p className="text-xs font-bold text-red-400 leading-snug">
                    Punto de equilibrio no alcanzable con la rentabilidad actual.
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Actualmente tu gasto publicitario/operación supera tus ingresos de venta. Optimiza tus campañas o precio antes de calcular el punto de equilibrio.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-zinc-400">Facturación requerida:</span>
                    <span className="text-xl font-black font-mono text-white">{formatCurrency(breakEvenRevenue)}</span>
                  </div>

                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between text-xs">
                    {totalRevenue >= breakEvenRevenue ? (
                      <span className="font-bold text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Punto de equilibrio alcanzado.
                      </span>
                    ) : (
                      <span className="font-bold text-amber-400 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Te faltan {formatCurrency(breakEvenRevenue - totalRevenue)} para cubrir el mes.
                      </span>
                    )}
                    <span className="font-mono text-xs font-bold text-zinc-400">
                      {totalRevenue >= breakEvenRevenue ? "100%" : `${Math.round((totalRevenue / breakEvenRevenue) * 100)}%`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Proyección al Cierre del Mes */}
            <div className="glass-card p-6 sm:p-7 bg-[#0c0c0e]/80 border border-white/[0.06] rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <BarChart3 className="w-4.5 h-4.5 text-blue-400" /> Proyección al Cierre del Mes
                </h4>
                <span className="text-[11px] text-zinc-500 font-mono">
                  Día {currentDayPassed} de {totalDaysInMonth}
                </span>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-zinc-500 font-sans font-semibold">Ingreso Proyectado</p>
                    <p className="text-white font-bold text-sm mt-0.5">{formatCurrency(projectedClosingRevenue)}</p>
                  </div>
                  <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-zinc-500 font-sans font-semibold">Gasto Op Proyectado</p>
                    <p className="text-zinc-400 font-bold text-sm mt-0.5">{formatCurrency(projectedClosingAdSpend)}</p>
                  </div>
                </div>

                <div
                  className={cn(
                    "p-4 rounded-2xl border text-xs font-semibold leading-relaxed",
                    projectedClosingResult >= 0
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                      : "bg-red-500/10 border-red-500/20 text-red-300"
                  )}
                >
                  {projectedClosingResult >= 0 ? (
                    <span>Al ritmo actual cerrarías aproximadamente con <strong className="font-mono text-emerald-400 font-black">+{formatCurrency(projectedClosingResult)}</strong> de utilidad.</span>
                  ) : (
                    <span>Al ritmo actual cerrarías aproximadamente con <strong className="font-mono text-red-400 font-black">-{formatCurrency(Math.abs(projectedClosingResult))}</strong> de pérdida.</span>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* ── 5. TABLA DE OPERACIÓN POR PRODUCTO ── */}
          <div className="glass-card bg-[#0c0c0e]/80 border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] bg-[#0c0c0e]/50">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <ShoppingBag className="w-4.5 h-4.5 text-amber-400" /> Operación de Productos del Mes
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {usingVibe
                    ? "Pauta y ventas absorbidas automáticamente desde Vibe; los gastos fijos permanecen en Personal Tracker"
                    : "Registra tus lanzamientos y gasto publicitario directo"}
                </p>
              </div>

              {usingVibe ? (
                <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  Fuente canónica · Vibe
                </span>
              ) : (
                <button
                  onClick={() => handleOpenOpModal()}
                  className="btn-primary px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-lg font-bold"
                >
                  <Plus className="w-4 h-4" /> Agregar Producto
                </button>
              )}
            </div>

            {monthOps.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.04] bg-white/[0.01] text-[10px] font-black uppercase tracking-wider text-zinc-500">
                      <th className="py-4 px-6">Producto</th>
                      <th className="py-4 px-6 text-right">Gasto Publicidad/Op</th>
                      <th className="py-4 px-6 text-right">Ingreso</th>
                      <th className="py-4 px-6 text-center">Ventas</th>
                      <th className="py-4 px-6 text-center">Conversaciones</th>
                      <th className="py-4 px-6 text-right">Resultado</th>
                      <th className="py-4 px-6 text-center">ROAS</th>
                      <th className="py-4 px-6 text-right">CPA</th>
                      <th className="py-4 px-6 text-center">Margen</th>
                      <th className="py-4 px-6 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-xs font-mono">
                    {monthOps.map((op) => {
                      const res = op.revenue - op.adSpend;
                      const roas = op.adSpend > 0 ? op.revenue / op.adSpend : op.revenue > 0 ? 999 : 0;
                      const cpa = op.salesCount && op.salesCount > 0 ? op.adSpend / op.salesCount : null;
                      const marginPct = op.revenue > 0 ? ((op.revenue - op.adSpend) / op.revenue) * 100 : 0;

                      return (
                        <tr key={op.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-6 font-sans font-bold text-white text-sm">
                            <div>{op.productName}</div>
                            {op.source === "VIBE" && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-400">
                                  Vibe
                                </span>
                                <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-400">
                                  {op.track === "WHATSAPP" ? "WhatsApp" : op.track === "LANDING" ? "Landing" : "Sin clasificar"}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right text-red-400 font-black">-{op.source === "VIBE" ? formatCurrencyPrecise(op.adSpend) : formatCurrency(op.adSpend)}</td>
                          <td className="py-4 px-6 text-right text-emerald-400 font-black">+{op.source === "VIBE" ? formatCurrencyPrecise(op.revenue) : formatCurrency(op.revenue)}</td>
                          <td className="py-4 px-6 text-center text-zinc-300 font-semibold">{op.salesCount ?? "-"}</td>
                          <td className="py-4 px-6 text-center text-blue-400 font-semibold">{op.conversations ?? "-"}</td>
                          <td className={cn("py-4 px-6 text-right font-black", res >= 0 ? "text-emerald-400" : "text-red-400")}>
                            {res >= 0 ? `+${formatCurrency(res)}` : formatCurrency(res)}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span className={cn("px-2.5 py-1 rounded-lg border text-[11px] font-black", roas >= 1.5 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : roas >= 1 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>
                              {roas === 999 ? "∞" : `${roas.toFixed(2)}x`}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right text-zinc-400">
                            {cpa !== null ? formatCurrency(cpa) : "-"}
                          </td>
                          <td className="py-4 px-6 text-center text-zinc-300 font-semibold">
                            {marginPct.toFixed(0)}%
                          </td>
                          <td className="py-4 px-6 text-right">
                            {op.source === "VIBE" ? (
                              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                                Solo lectura
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenOpModal(op)}
                                className="p-2 rounded-xl border border-white/5 bg-white/5 text-zinc-400 hover:text-amber-400 hover:border-amber-500/20 transition-all"
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteOp(op.id)}
                                className="p-2 rounded-xl border border-white/5 bg-white/5 text-zinc-400 hover:text-red-400 hover:border-red-500/20 transition-all"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 text-center space-y-3">
                <ShoppingBag className="w-9 h-9 text-zinc-700 mx-auto" />
                <p className="text-xs font-bold text-zinc-400">Sin productos u operación registrados en {formatMonthLabel(selectedMonth)}</p>
                {!usingVibe && (
                  <button
                    onClick={() => handleOpenOpModal()}
                    className="btn-primary px-5 py-2.5 rounded-2xl text-xs font-bold shadow-lg"
                  >
                    + Registrar Primer Producto
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── 6. GASTOS FIJOS RECURRENTES ── */}
          <div className="glass-card bg-[#0c0c0e]/80 border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 border-b border-white/[0.06] bg-[#0c0c0e]/50">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <Layers className="w-4.5 h-4.5 text-blue-400" /> Gastos Fijos Recurrentes
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Se aplican automáticamente desde el mes en que los declaras y en todos los siguientes
                </p>
                <p className="mt-1 text-[10px] text-zinc-500">
                  El runway consolida estas series versionadas y los fijos/suscripciones de la pestaña Gastos, sin duplicar conceptos coincidentes.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={() => handleOpenFixedModal()}
                  className="btn-primary px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg"
                >
                  <Plus className="w-4 h-4" /> Agregar Gasto Fijo
                </button>
              </div>
            </div>

            {monthFixed.length + monthBusinessFixed.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {monthFixed.map((fix) => (
                  <div key={fix.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                    <div>
                      <p className="text-xs font-bold text-zinc-200">{fix.concept}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">
                        Activo desde {formatMonthLabel(fix.resolvedEffectiveFrom)} · se repite cada mes
                      </p>
                    </div>

                    <div className="flex items-center gap-5 font-mono">
                      <span className="text-sm font-black text-blue-400">-{formatCurrency(nonNegativeAmount(fix.amount))}</span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenFixedModal(fix)}
                          disabled={fixedMutationPending}
                          className="p-2 rounded-xl border border-white/5 bg-white/5 text-zinc-400 hover:text-amber-400 transition-all"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCancelFixed(fix)}
                          disabled={fixedMutationPending}
                          className="p-2 rounded-xl border border-white/5 bg-white/5 text-zinc-400 hover:text-red-400 transition-all"
                          title={`Detener desde ${formatMonthLabel(selectedMonth)}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {monthBusinessFixed.map((expense) => (
                  <div key={`general:${expense.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                    <div>
                      <p className="text-xs font-bold text-zinc-200">{expense.name}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">
                        Activo desde {formatMonthLabel(expense.effectiveFrom || expense.month)} · gestionado en la pestaña Gastos
                      </p>
                    </div>

                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-sm font-black text-violet-400">-{formatCurrency(nonNegativeAmount(expense.amount))}</span>
                      <span className="rounded-lg border border-violet-500/15 bg-violet-500/[0.06] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-violet-300">
                        {expense.type === "SUSCRIPCION" ? "Suscripción" : "Gasto"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center space-y-3">
                <Layers className="w-9 h-9 text-zinc-700 mx-auto" />
                <p className="text-xs font-bold text-zinc-400">Sin gastos fijos activos en {formatMonthLabel(selectedMonth)}</p>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  Agrega un concepto una sola vez; quedará recurrente hasta que lo detengas.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════
          MODE B: ANNUAL DASHBOARD VIEW
      ════════════════════════════════════════════════ */}
      {viewMode === "ANNUAL" && (
        <>
          {/* ── 1. METRICAS ANUALES CONSOLIDADAS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">

            {/* Ingreso Total Anual */}
            <div className="glass-card p-6 bg-[#0c0c0e]/90 border border-emerald-500/15 rounded-3xl flex flex-col justify-between space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Ingreso Anual</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight">{formatCurrency(annualRevenue)}</p>
                <p className="text-[11px] text-zinc-500 font-mono mt-1">{annualPeriodLabel}</p>
              </div>
            </div>

            {/* Gasto Total Anual */}
            <div className="glass-card p-6 bg-[#0c0c0e]/90 border border-red-500/15 rounded-3xl flex flex-col justify-between space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Gastos Anuales</span>
                <TrendingDown className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-red-400 font-mono tracking-tight">{formatCurrency(annualTotalExpenses)}</p>
                <p className="text-[11px] text-zinc-500 font-mono mt-1">{annualPeriodLabel} · Op: {formatCurrency(annualAdSpend)} · Fijos: {formatCurrency(annualFixedExpenses)} · Otros: {formatCurrency(annualOtherOperatingExpenses)}</p>
              </div>
            </div>

            {/* Resultado Neto Anual */}
            <div className={cn("glass-card p-6 bg-[#0c0c0e]/90 rounded-3xl flex flex-col justify-between space-y-3 shadow-xl border", annualNetResult >= 0 ? "border-emerald-500/20" : "border-red-500/20")}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Resultado Anual</span>
                <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border", annualNetResult >= 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>
                  {annualNetResult >= 0 ? "+ POSITIVO" : "- DEFICIT"}
                </span>
              </div>
              <div>
                <p className={cn("text-xl sm:text-2xl font-black font-mono tracking-tight", annualNetResult >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {annualNetResult >= 0 ? `+${formatCurrency(annualNetResult)}` : formatCurrency(annualNetResult)}
                </p>
                <p className="text-[11px] text-zinc-500 font-mono mt-1">Resultado · {annualPeriodLabel}</p>
              </div>
            </div>

            {/* ROAS Promedio Anual */}
            <div className="glass-card p-6 bg-[#0c0c0e]/90 border border-amber-500/15 rounded-3xl flex flex-col justify-between space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">ROAS Anual</span>
                <BarChart3 className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight">
                  {annualROAS === 999 ? "∞" : `${annualROAS.toFixed(2)}x`}
                </p>
                <p className="text-[11px] text-zinc-500 font-mono mt-1">Ingreso Anual / Ad Spend</p>
              </div>
            </div>

            {/* Punto de Equilibrio Anual */}
            <div className="glass-card p-6 bg-[#0c0c0e]/90 border border-blue-500/15 rounded-3xl flex flex-col justify-between space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">PE Anual</span>
                <Target className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                  {annualBreakEven !== null ? formatCurrency(annualBreakEven) : "N/A"}
                </p>
                <p className="text-[11px] text-zinc-500 font-mono mt-1">Facturación anual requerida</p>
              </div>
            </div>

          </div>

          {annualIncompleteMonths.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-[11px] leading-relaxed text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                El acumulado tiene {annualIncompleteMonths.length} mes{annualIncompleteMonths.length === 1 ? "" : "es"} con Vibe pendiente, provisional o con fuentes incompletas. Las cifras se conservan como estimación junto con los gastos conocidos; esos meses no reciben un diagnóstico confirmado ni alimentan el runway.
              </p>
            </div>
          )}

          {/* ── 2. MATRIZ DE SALUD DE LOS 12 MESES ── */}
          <div className="glass-card bg-[#0c0c0e]/80 border border-white/[0.06] rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <Grid className="w-4.5 h-4.5 text-amber-400" /> Matriz Anual de Salud Financiera ({selectedYear})
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Diagnóstico mensual del comportamiento de tu negocio</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {annualMonthsGrid.map((m) => (
                <div
                  key={m.key}
                  onClick={() => {
                    if (m.isFuture) return;
                    setSelectedMonth(m.key);
                    setViewMode("MONTHLY");
                  }}
                  className={cn(
                    "p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 relative overflow-hidden",
                    m.isFuture ? "cursor-default" : "cursor-pointer hover:scale-[1.02]",
                    m.status === "BIEN"
                      ? "bg-emerald-950/20 border-emerald-500/20 hover:border-emerald-500/40"
                      : m.status === "ATENCION"
                      ? "bg-amber-950/20 border-amber-500/20 hover:border-amber-500/40"
                      : m.status === "MAL"
                      ? "bg-red-950/20 border-red-500/20 hover:border-red-500/40"
                      : m.status === "INCOMPLETE"
                      ? "bg-amber-950/10 border-amber-500/15 hover:border-amber-500/30"
                      : m.status === "PLANNED"
                      ? "bg-blue-950/20 border-blue-500/15 hover:border-blue-500/30"
                      : "bg-white/[0.01] border-white/[0.04] opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black font-mono text-white">{m.monthName}</span>
                    <span className="text-sm">
                      {m.status === "BIEN" ? "🟢" : m.status === "ATENCION" ? "🟡" : m.status === "MAL" ? "🔴" : m.status === "INCOMPLETE" ? "🟠" : m.status === "PLANNED" ? "🔵" : "⚪"}
                    </span>
                  </div>

                  {m.status === "PLANNED" ? (
                    <div className="space-y-1 font-mono text-[10px] text-blue-300">
                      <p className="font-black uppercase tracking-wider">Planeado</p>
                      <p>Fijos: {formatCurrency(m.fix)}</p>
                      {m.other > 0 && <p>Otros: {formatCurrency(m.other)}</p>}
                    </div>
                  ) : m.status === "INCOMPLETE" ? (
                    <div className="space-y-1 font-mono text-[10px] text-amber-300">
                      <p className="font-black uppercase tracking-wider">Datos incompletos</p>
                      <p>Fijos conocidos: {formatCurrency(m.fix)}</p>
                      {m.other > 0 && <p>Otros: {formatCurrency(m.other)}</p>}
                    </div>
                  ) : m.status !== "EMPTY" ? (
                    <div className="space-y-1 font-mono text-[11px]">
                      <div className="flex justify-between text-emerald-400">
                        <span>Ing:</span>
                        <span className="font-bold">+{formatCurrency(m.rev)}</span>
                      </div>
                      <div className="flex justify-between text-red-400">
                        <span>Gast:</span>
                        <span className="font-bold">-{formatCurrency(m.ad + m.fix + m.other)}</span>
                      </div>
                      <div className={cn("flex justify-between font-black pt-1 border-t border-white/5", m.net >= 0 ? "text-emerald-400" : "text-red-400")}>
                        <span>Net:</span>
                        <span>{m.net >= 0 ? `+${formatCurrency(m.net)}` : formatCurrency(m.net)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-600 font-mono italic">Sin registros</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── 3. RESUMEN ANUAL POR PRODUCTO ── */}
          <div className="glass-card bg-[#0c0c0e]/80 border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] bg-[#0c0c0e]/50">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <ShoppingBag className="w-4.5 h-4.5 text-amber-400" /> Rendimiento Anual por Producto ({selectedYear})
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Métricas consolidadas del periodo: {annualPeriodLabel}</p>
              </div>
            </div>

            {annualProductSummaries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.04] bg-white/[0.01] text-[10px] font-black uppercase tracking-wider text-zinc-500">
                      <th className="py-4 px-6">Producto</th>
                      <th className="py-4 px-6 text-right">Ad Spend Anual</th>
                      <th className="py-4 px-6 text-right">Ingreso Anual</th>
                      <th className="py-4 px-6 text-center">Ventas Totales</th>
                      <th className="py-4 px-6 text-right">Resultado Anual</th>
                      <th className="py-4 px-6 text-center">ROAS Anual</th>
                      <th className="py-4 px-6 text-right">CPA Promedio</th>
                      <th className="py-4 px-6 text-center">Margen Anual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-xs font-mono">
                    {annualProductSummaries.map((p) => (
                      <tr key={p.productName} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-6 font-sans font-bold text-white text-sm">{p.productName}</td>
                        <td className="py-4 px-6 text-right text-red-400 font-black">-{formatCurrency(p.adSpend)}</td>
                        <td className="py-4 px-6 text-right text-emerald-400 font-black">+{formatCurrency(p.revenue)}</td>
                        <td className="py-4 px-6 text-center text-zinc-300 font-semibold">{p.sales || "-"}</td>
                        <td className={cn("py-4 px-6 text-right font-black", p.profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {p.profit >= 0 ? `+${formatCurrency(p.profit)}` : formatCurrency(p.profit)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={cn("px-2.5 py-1 rounded-lg border text-[11px] font-black", p.roas >= 1.5 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : p.roas >= 1 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>
                            {p.roas === 999 ? "∞" : `${p.roas.toFixed(2)}x`}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right text-zinc-400">
                          {p.cpa !== null ? formatCurrency(p.cpa) : "-"}
                        </td>
                        <td className="py-4 px-6 text-center text-zinc-300 font-semibold">
                          {p.marginPct.toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 text-center space-y-3">
                <ShoppingBag className="w-9 h-9 text-zinc-700 mx-auto" />
                <p className="text-xs font-bold text-zinc-400">Sin lanzamientos u operaciones registradas en el año {selectedYear}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── MODAL: OPERACIÓN PRODUCTO ── */}
      {opModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0c0c0e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                {editingOpId ? "Editar Producto" : "Agregar Registro de Producto"}
              </h3>
              <button
                onClick={() => setOpModalOpen(false)}
                className="text-zinc-500 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Nombre del Producto</label>
                <input
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder="Ej. Costura WA, Molde Digital..."
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Gasto Ads / Op ($)</label>
                  <input
                    type="number"
                    min="0"
                    max="100000000"
                    step="0.01"
                    value={pAdSpend}
                    onChange={(e) => setPAdSpend(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Ingreso ($)</label>
                  <input
                    type="number"
                    min="0"
                    max="100000000"
                    step="0.01"
                    value={pRevenue}
                    onChange={(e) => setPRevenue(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Ventas (Opcional)</label>
                <input
                  type="number"
                  min="0"
                  max="100000000"
                  step="1"
                  value={pSales}
                  onChange={(e) => setPSales(e.target.value)}
                  placeholder="Ej. 17"
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setOpModalOpen(false)}
                className="px-4 py-2 rounded-2xl text-xs text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveOp}
                disabled={!pName.trim()}
                className="btn-primary px-5 py-2.5 rounded-2xl text-xs font-bold disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: GASTO FIJO ── */}
      {fixedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0c0c0e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                {editingFixedSeriesId ? "Actualizar Gasto Fijo" : "Agregar Gasto Fijo"}
              </h3>
              <button
                onClick={() => setFixedModalOpen(false)}
                className="text-zinc-500 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Concepto</label>
                <input
                  value={fConcept}
                  onChange={(e) => setFConcept(e.target.value)}
                  placeholder="Ej. ElevenLabs, ClicChat, Colchón / reserva..."
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Monto ($)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={fAmount}
                  onChange={(e) => setFAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <p className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.05] p-3 text-[10px] leading-relaxed text-zinc-400">
                {editingFixedSeriesId
                  ? `El nuevo valor aplicará desde ${formatMonthLabel(selectedMonth)}; los meses anteriores no cambiarán.`
                  : `Se repetirá cada mes desde ${formatMonthLabel(selectedMonth)} hasta que lo detengas.`}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setFixedModalOpen(false)}
                className="px-4 py-2 rounded-2xl text-xs text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveFixed}
                disabled={
                  !fConcept.trim() ||
                  !Number.isFinite(Number(fAmount)) ||
                  Number(fAmount) <= 0 ||
                  fixedMutationPending
                }
                className="btn-primary px-5 py-2.5 rounded-2xl text-xs font-bold disabled:opacity-50"
              >
                {fixedMutationPending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIGURAR CAJA DISPONIBLE ── */}
      {configModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0c0c0e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Configurar Caja Disponible
              </h3>
              <button
                onClick={() => setConfigModalOpen(false)}
                className="text-zinc-500 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Caja / Capital Disponible Hoy ($)</label>
                <input
                  type="number"
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                  placeholder="20000"
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Saldo líquido actual usado por el único cálculo de runway. Actualízalo cuando cambie tu caja real.</p>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Costo Estimado de Testeo por Producto ($)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={testCostInput}
                  onChange={(e) => setTestCostInput(e.target.value)}
                  placeholder="1000"
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setConfigModalOpen(false)}
                className="px-4 py-2 rounded-2xl text-xs text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveConfig}
                className="btn-primary px-5 py-2.5 rounded-2xl text-xs font-bold"
              >
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
