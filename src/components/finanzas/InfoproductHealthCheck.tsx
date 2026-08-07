"use client";

import { useState, useMemo } from "react";
import {
  InfoproductOp,
  InfoproductFixedExpense,
} from "@/lib/types";
import {
  createFinance,
  updateFinance,
  removeFinance,
} from "@/lib/repositories/firestore";
import { formatCurrency, cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Copy,
  Calendar,
  Sparkles,
  Target,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Layers,
  ShoppingBag,
  Wallet,
  Package,
  Settings,
} from "lucide-react";

interface Props {
  userId: string;
  ops: InfoproductOp[];
  fixedExpenses: InfoproductFixedExpense[];
  initialBusinessCapital: number;
  productTestCost: number;
  onSaveBusinessConfig: (capital: number, testCost: number) => Promise<void>;
  onRefresh: () => void;
}

export default function InfoproductHealthCheck({
  userId,
  ops,
  fixedExpenses,
  initialBusinessCapital,
  productTestCost,
  onSaveBusinessConfig,
  onRefresh,
}: Props) {
  // ── Month Selector State ──
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  // ── Form Modals State ──
  const [opModalOpen, setOpModalOpen] = useState(false);
  const [fixedModalOpen, setFixedModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);

  // Op Form
  const [pName, setPName] = useState("");
  const [pAdSpend, setPAdSpend] = useState("");
  const [pRevenue, setPRevenue] = useState("");
  const [pSales, setPSales] = useState("");

  // Fixed Form
  const [fConcept, setFConcept] = useState("");
  const [fAmount, setFAmount] = useState("");

  // Capital Config Form
  const [capInput, setCapInput] = useState(initialBusinessCapital.toString());
  const [testCostInput, setTestCostInput] = useState(productTestCost.toString());

  // Format YYYY-MM to "Agosto 2026"
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

  // Filter ops & fixed expenses by selected month
  const monthOps = useMemo(() => {
    return ops.filter((o) => o.month === selectedMonth);
  }, [ops, selectedMonth]);

  const monthFixed = useMemo(() => {
    return fixedExpenses.filter((f) => f.month === selectedMonth);
  }, [fixedExpenses, selectedMonth]);

  // ── Core Calculations ──
  const totalRevenue = useMemo(() => {
    return monthOps.reduce((sum, o) => sum + (o.revenue || 0), 0);
  }, [monthOps]);

  const totalAdSpend = useMemo(() => {
    return monthOps.reduce((sum, o) => sum + (o.adSpend || 0), 0);
  }, [monthOps]);

  const totalFixedExpenses = useMemo(() => {
    return monthFixed.reduce((sum, f) => sum + (f.amount || 0), 0);
  }, [monthFixed]);

  const totalExpenses = totalAdSpend + totalFixedExpenses;
  const netResult = totalRevenue - totalExpenses;
  const contributionMargin = totalRevenue - totalAdSpend;
  const contributionMarginRatio = totalRevenue > 0 ? contributionMargin / totalRevenue : 0;

  // Global Business Metrics
  const currentBusinessCapital = initialBusinessCapital + netResult;
  const burnRate = netResult < 0 ? Math.abs(netResult) : 0;
  const runwayMonths =
    netResult >= 0
      ? null
      : burnRate > 0 && currentBusinessCapital > 0
      ? currentBusinessCapital / burnRate
      : 0;
  const testCost = productTestCost > 0 ? productTestCost : 1000;
  const possibleTests =
    currentBusinessCapital > 0 ? Math.floor(currentBusinessCapital / testCost) : 0;

  // ROAS Global
  const globalROAS = totalAdSpend > 0 ? totalRevenue / totalAdSpend : totalRevenue > 0 ? 999 : 0;

  // Break-even Revenue (Punto de Equilibrio)
  const breakEvenRevenue =
    contributionMarginRatio > 0
      ? totalFixedExpenses / contributionMarginRatio
      : null;

  const breakEvenDiff =
    breakEvenRevenue !== null ? breakEvenRevenue - totalRevenue : null;

  // ── Month-End Projection ──
  const [projYear, projMonthNum] = selectedMonth.split("-").map(Number);
  const totalDaysInMonth = new Date(projYear, projMonthNum, 0).getDate();
  const isCurrentMonthSelected = selectedMonth === currentMonthKey;
  const currentDayPassed = isCurrentMonthSelected ? Math.min(now.getDate(), totalDaysInMonth) : totalDaysInMonth;

  const dailyRevenueRate = currentDayPassed > 0 ? totalRevenue / currentDayPassed : 0;
  const dailyAdSpendRate = currentDayPassed > 0 ? totalAdSpend / currentDayPassed : 0;

  const projectedClosingRevenue = dailyRevenueRate * totalDaysInMonth;
  const projectedClosingAdSpend = dailyAdSpendRate * totalDaysInMonth;
  const projectedClosingResult = projectedClosingRevenue - projectedClosingAdSpend - totalFixedExpenses;

  // ── Health Check Decision Matrix ──
  let healthStatus: "BIEN" | "ATENCION" | "MAL" = "BIEN";
  let healthMessage = "";
  let healthSub = "";

  if (contributionMargin <= 0 && (totalAdSpend > 0 || totalRevenue > 0)) {
    healthStatus = "MAL";
    healthMessage = "No escales todavía. Actualmente estás gastando más para generar cada peso de ingreso.";
    healthSub = "La operación del producto tiene un margen de contribución negativo o en cero.";
  } else if (contributionMargin > 0 && netResult < 0 && (breakEvenRevenue === null || projectedClosingRevenue < breakEvenRevenue)) {
    healthStatus = "ATENCION";
    healthMessage = "Tu operación deja margen, pero todavía necesitas más ventas para cubrir los gastos del mes.";
    healthSub = `Tu margen cubre parte de los gastos fijos, pero aún te faltan ${formatCurrency(Math.max(0, breakEvenDiff || 0))} para el punto de equilibrio.`;
  } else {
    healthStatus = "BIEN";
    healthMessage = "Vas bien. La operación es rentable y estás en camino de cubrir el mes.";
    healthSub = netResult >= 0
      ? "Tus ingresos ya superaron los gastos fijos y de operación. ¡El negocio está en utilidad!"
      : "Al ritmo proyectado actual terminarás el mes en terreno positivo.";
  }

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
    const payload = {
      month: selectedMonth,
      productName: pName.trim(),
      adSpend: Number(pAdSpend) || 0,
      revenue: Number(pRevenue) || 0,
      salesCount: pSales ? Number(pSales) : undefined,
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
      setEditingFixedId(fix.id);
      setFConcept(fix.concept);
      setFAmount(fix.amount.toString());
    } else {
      setEditingFixedId(null);
      setFConcept("");
      setFAmount("");
    }
    setFixedModalOpen(true);
  };

  const handleSaveFixed = async () => {
    if (!userId || !fConcept.trim()) return;
    const payload = {
      month: selectedMonth,
      concept: fConcept.trim(),
      amount: Number(fAmount) || 0,
    };

    if (editingFixedId) {
      await updateFinance(userId, "infoproduct_fixed_expenses", editingFixedId, payload);
    } else {
      await createFinance(userId, "infoproduct_fixed_expenses", payload);
    }
    setFixedModalOpen(false);
    onRefresh();
  };

  const handleDeleteFixed = async (id: string) => {
    if (!userId) return;
    await removeFinance(userId, "infoproduct_fixed_expenses", id);
    onRefresh();
  };

  const handleCopyPrevMonthFixed = async () => {
    if (!userId) return;
    const [year, month] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const prevItems = fixedExpenses.filter((f) => f.month === prevKey);

    if (prevItems.length === 0) return;

    for (const item of prevItems) {
      await createFinance(userId, "infoproduct_fixed_expenses", {
        month: selectedMonth,
        concept: item.concept,
        amount: item.amount,
      });
    }
    onRefresh();
  };

  const handleOpenConfigModal = () => {
    setCapInput(initialBusinessCapital.toString());
    setTestCostInput(productTestCost.toString());
    setConfigModalOpen(true);
  };

  const handleSaveConfig = async () => {
    const cap = Number(capInput) || 0;
    const tCost = Number(testCostInput) || 1000;
    await onSaveBusinessConfig(cap, tCost);
    setConfigModalOpen(false);
    onRefresh();
  };

  // Quick Seed Sample Data
  const handleSeedSample = async () => {
    if (!userId) return;
    await createFinance(userId, "infoproduct_ops", {
      month: selectedMonth,
      productName: "Costura WA",
      adSpend: 2100,
      revenue: 1750,
      salesCount: 17,
    });

    const sampleFixed = [
      { concept: "Magnific", amount: 400 },
      { concept: "ElevenLabs", amount: 400 },
      { concept: "ClicChat", amount: 1000 },
      { concept: "Colchón / reserva", amount: 2200 },
    ];

    for (const fx of sampleFixed) {
      await createFinance(userId, "infoproduct_fixed_expenses", {
        month: selectedMonth,
        concept: fx.concept,
        amount: fx.amount,
      });
    }
    onRefresh();
  };

  return (
    <div className="space-y-8">

      {/* ── 1. HEADER & SELECTOR DE MES ── */}
      <div className="glass-card p-6 bg-[#0c0c0e]/95 border border-white/[0.06] rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 shadow-lg">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black uppercase tracking-wider text-white">Periodo de Análisis</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Indicadores en tiempo real para {formatMonthLabel(selectedMonth)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <button
            onClick={handleOpenConfigModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-white/[0.03] border border-white/[0.08] text-zinc-300 hover:text-amber-400 hover:border-amber-500/30 transition-all"
          >
            <Settings className="w-4 h-4" />
            Configurar Capital Base
          </button>

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
              className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. METRICAS DE NEGOCIO Y PRESUPUESTO (SPACIOUS STAT CARDS) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Presupuesto Disponible */}
        <div className="glass-card p-6 bg-[#0c0c0e]/90 border border-emerald-500/15 rounded-3xl flex flex-col justify-between space-y-3 hover:border-emerald-500/30 transition-all shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Presupuesto Disponible</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className={cn("text-xl sm:text-2xl font-black font-mono tracking-tight", currentBusinessCapital >= 0 ? "text-emerald-400" : "text-red-400")}>
              {formatCurrency(currentBusinessCapital)}
            </p>
            <p className="text-[11px] text-zinc-500 font-mono mt-1">
              Base: {formatCurrency(initialBusinessCapital)}
            </p>
          </div>
        </div>

        {/* Ingresos Totales del Mes */}
        <div className="glass-card p-6 bg-[#0c0c0e]/90 border border-emerald-500/15 rounded-3xl flex flex-col justify-between space-y-3 hover:border-emerald-500/30 transition-all shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Ingresos del Mes</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight">{formatCurrency(totalRevenue)}</p>
            <p className="text-[11px] text-zinc-500 font-mono mt-1">
              {monthOps.length} producto{monthOps.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Gastos Totales del Mes */}
        <div className="glass-card p-6 bg-[#0c0c0e]/90 border border-red-500/15 rounded-3xl flex flex-col justify-between space-y-3 hover:border-red-500/30 transition-all shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Gastos del Mes</span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-red-400 font-mono tracking-tight">{formatCurrency(totalExpenses)}</p>
            <p className="text-[11px] text-zinc-500 font-mono mt-1">
              Fijos: {formatCurrency(totalFixedExpenses)}
            </p>
          </div>
        </div>

        {/* Runway Estimado */}
        <div className="glass-card p-6 bg-[#0c0c0e]/90 border border-blue-500/15 rounded-3xl flex flex-col justify-between space-y-3 hover:border-blue-500/30 transition-all shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Runway Estimado</span>
            <BarChart3 className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
              {runwayMonths === null ? "Sostenible" : `${runwayMonths.toFixed(1)} meses`}
            </p>
            <p className="text-[11px] text-zinc-500 font-mono mt-1">
              {burnRate > 0 ? `Burn: -${formatCurrency(burnRate)}/mes` : "En utilidad"}
            </p>
          </div>
        </div>

        {/* Testeo de Productos */}
        <div className="glass-card p-6 bg-[#0c0c0e]/90 border border-amber-500/15 rounded-3xl flex flex-col justify-between space-y-3 hover:border-amber-500/30 transition-all shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Testeo de Productos</span>
            <Package className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight">
              ~{possibleTests} producto{possibleTests !== 1 ? "s" : ""}
            </p>
            <p className="text-[11px] text-zinc-500 font-mono mt-1">
              Costo test: {formatCurrency(testCost)}
            </p>
          </div>
        </div>

      </div>

      {/* ── 3. ESTADO HEALTH CHECK (BIG & VISUAL BANNER) ── */}
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
              "{healthMessage}"
            </h3>
            <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
              {healthSub}
            </p>
          </div>
        </div>

        {monthOps.length === 0 && monthFixed.length === 0 && (
          <button
            onClick={handleSeedSample}
            className="px-5 py-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 shadow-lg"
          >
            <Sparkles className="w-4 h-4" /> Cargar Ejemplo Inicial
          </button>
        )}
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
            <p className="text-xs text-zinc-400 mt-0.5">Registra tus lanzamientos y gasto publicitario directo</p>
          </div>

          <button
            onClick={() => handleOpenOpModal()}
            className="btn-primary px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-lg font-bold"
          >
            <Plus className="w-4 h-4" /> Agregar Producto
          </button>
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
                      <td className="py-4 px-6 font-sans font-bold text-white text-sm">{op.productName}</td>
                      <td className="py-4 px-6 text-right text-red-400 font-black">-{formatCurrency(op.adSpend)}</td>
                      <td className="py-4 px-6 text-right text-emerald-400 font-black">+{formatCurrency(op.revenue)}</td>
                      <td className="py-4 px-6 text-center text-zinc-300 font-semibold">{op.salesCount ?? "-"}</td>
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
            <button
              onClick={() => handleOpenOpModal()}
              className="btn-primary px-5 py-2.5 rounded-2xl text-xs font-bold shadow-lg"
            >
              + Registrar Primer Producto
            </button>
          </div>
        )}
      </div>

      {/* ── 6. GASTOS FIJOS EN SECCIÓN SECUNDARIA ── */}
      <div className="glass-card bg-[#0c0c0e]/80 border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 border-b border-white/[0.06] bg-[#0c0c0e]/50">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Layers className="w-4.5 h-4.5 text-blue-400" /> Gastos Fijos Mensuales
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">Herramientas, software, equipo y reserva fija del mes</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {monthFixed.length === 0 && (
              <button
                onClick={handleCopyPrevMonthFixed}
                className="px-4 py-2 rounded-2xl border border-white/10 bg-white/5 hover:border-blue-500/30 hover:text-blue-400 text-xs font-semibold text-zinc-300 transition-all flex items-center gap-2"
              >
                <Copy className="w-4 h-4" /> Copiar del mes anterior
              </button>
            )}

            <button
              onClick={() => handleOpenFixedModal()}
              className="btn-primary px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-4 h-4" /> Agregar Gasto Fijo
            </button>
          </div>
        </div>

        {monthFixed.length > 0 ? (
          <div className="divide-y divide-white/[0.04]">
            {monthFixed.map((fix) => (
              <div key={fix.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <span className="text-xs font-bold text-zinc-200">{fix.concept}</span>

                <div className="flex items-center gap-5 font-mono">
                  <span className="text-sm font-black text-blue-400">-{formatCurrency(fix.amount)}</span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenFixedModal(fix)}
                      className="p-2 rounded-xl border border-white/5 bg-white/5 text-zinc-400 hover:text-amber-400 transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFixed(fix.id)}
                      className="p-2 rounded-xl border border-white/5 bg-white/5 text-zinc-400 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center space-y-3">
            <Layers className="w-9 h-9 text-zinc-700 mx-auto" />
            <p className="text-xs font-bold text-zinc-400">Sin gastos fijos configurados para {formatMonthLabel(selectedMonth)}</p>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">Agrega conceptos como software, herramientas o tu reserva mensual.</p>
          </div>
        )}
      </div>

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
                {editingFixedId ? "Editar Gasto Fijo" : "Agregar Gasto Fijo"}
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
                  value={fAmount}
                  onChange={(e) => setFAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
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
                disabled={!fConcept.trim()}
                className="btn-primary px-5 py-2.5 rounded-2xl text-xs font-bold disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIGURAR CAPITAL BASE ── */}
      {configModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0c0c0e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Configurar Capital Base de Negocio
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
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Capital Inicial / Base ($)</label>
                <input
                  type="number"
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                  placeholder="20000"
                  className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Monto base del negocio para calcular el presupuesto disponible.</p>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Costo Estimado de Testeo por Producto ($)</label>
                <input
                  type="number"
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
