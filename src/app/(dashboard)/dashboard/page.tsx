"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { getAll, update, getAllFinance } from "@/lib/repositories/firestore";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { generateAlerts, Alert } from "@/lib/services/tracking.service";
import {
  Goal,
  Mission,
  TimeBlock,
  Income,
  Expense,
  Debt,
  DayOfWeek,
  BlockCategory,
  BlockStatus,
} from "@/lib/types";
import {
  Target,
  Trophy,
  ListChecks,
  Swords,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  Plus,
  Sparkles,
  Zap,
  Calendar,
  Heart,
  Smile,
  Activity,
  Briefcase,
  X,
  Check,
  Edit2,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { formatPercent, getStatusColor, formatCurrency } from "@/lib/utils";
import {
  addMonthsToMonthKey,
  resolveExpensesForMonth,
  resolveIncomesForMonth,
} from "@/lib/finance/business-metrics";
import { monthInMexicoCity } from "@/lib/time/month";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  CartesianGrid,
} from "recharts";

// ════════════════════════════════════════════════
// CONFIG & HELPERS
// ════════════════════════════════════════════════

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: "MON", label: "Lunes" },
  { key: "TUE", label: "Martes" },
  { key: "WED", label: "Miércoles" },
  { key: "THU", label: "Jueves" },
  { key: "FRI", label: "Viernes" },
  { key: "SAT", label: "Sábado" },
  { key: "SUN", label: "Domingo" },
];

const CATEGORY_CONFIG: Record<
  BlockCategory,
  { bg: string; text: string; border: string; icon: React.ElementType }
> = {
  TRABAJO: { bg: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20", text: "text-blue-400", border: "border-l-blue-500", icon: Briefcase },
  APRENDIZAJE: { bg: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20", text: "text-purple-400", border: "border-l-purple-500", icon: Zap },
  SALUD: { bg: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20", text: "text-emerald-400", border: "border-l-emerald-500", icon: Heart },
  PERSONAL: { bg: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20", text: "text-amber-400", border: "border-l-amber-500", icon: Activity },
  OCIO: { bg: "bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20", text: "text-pink-400", border: "border-l-pink-500", icon: Smile },
};

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${weekNum.toString().padStart(2, "0")}`;
}

const getDayKey = (d: Date): DayOfWeek => {
  const g = d.getDay();
  if (g === 1) return "MON";
  if (g === 2) return "TUE";
  if (g === 3) return "WED";
  if (g === 4) return "THU";
  if (g === 5) return "FRI";
  if (g === 6) return "SAT";
  return "SUN";
};

// ════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════

function AlertCard({ alert }: { alert: Alert }) {
  const [expanded, setExpanded] = useState(false);
  const styles = {
    danger: { border: "border-red-500/15", bg: "bg-red-500/[0.03]", dot: "bg-red-400", icon: <AlertTriangle className="w-4 h-4 text-red-400" /> },
    warning: { border: "border-amber-500/15", bg: "bg-amber-500/[0.03]", dot: "bg-amber-400", icon: <Clock className="w-4 h-4 text-amber-400" /> },
    info: { border: "border-blue-500/15", bg: "bg-blue-500/[0.03]", dot: "bg-blue-400", icon: <TrendingUp className="w-4 h-4 text-blue-400" /> },
  };
  const s = styles[alert.type];

  return (
    <div className={`p-4 rounded-2xl border ${s.border} ${s.bg} transition-all duration-300 hover:border-white/[0.06] hover:bg-white/[0.01]`}>
      <div className="flex items-center justify-between gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">{s.icon}</div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-zinc-200">{alert.title}</p>
            <p className="text-[10px] text-zinc-500 truncate mt-0.5">{alert.description}</p>
          </div>
        </div>
        <button className="text-zinc-500 hover:text-zinc-300">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/5 text-[11px] text-zinc-400 leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
          <p>{alert.description}</p>
          {alert.type === "danger" && (
            <p className="mt-2 text-red-400/90 font-semibold">⚠️ Requiere tu atención inmediata para mitigar el desvío operativo.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════

export default function DashboardPage() {
  const { user } = useAuth();
  const uid = useUid();

  // Core Data States
  const [goals, setGoals] = useState<Goal[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [savingsTotal, setSavingsTotal] = useState<number>(0);
  
  // UX States
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"operaciones" | "estrategia" | "finanzas">("operaciones");
  const [scratchpad, setScratchpad] = useState("");
  const [now, setNow] = useState(new Date());

  // Periodically refresh the time for active highlights
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch data
  const loadData = useCallback(async () => {
    if (!uid) return;
    try {
      const [g, m, t, incs, exps, dbs] = await Promise.all([
        getAll<Goal>(uid, "goals"),
        getAll<Mission>(uid, "missions"),
        getAll<TimeBlock>(uid, "timeBlocks"),
        getAllFinance<Income>(uid, "income"),
        getAllFinance<Expense>(uid, "expenses"),
        getAllFinance<Debt>(uid, "debts"),
      ]);

      setGoals(g);
      setMissions(m);
      setTimeBlocks(t);
      setIncomes(incs);
      setExpenses(exps);
      setDebts(dbs);
      setAlerts(generateAlerts(g, m));

      // Fetch Savings Plan for initial + actual savings
      const spQuery = query(
        collection(db, "savings_plans"),
        where("userId", "==", uid),
        where("year", "==", new Date().getFullYear())
      );
      const spSnap = await getDocs(spQuery);
      let totalSaved = 0;
      if (!spSnap.empty) {
        const spData = spSnap.docs[0].data();
        const initial = spData.initialSavings || 0;
        const actualValues = spData.actualSavingsValues || Array(12).fill(0);
        const actualSaved = actualValues.reduce((sum: number, val: number) => sum + val, 0);
        totalSaved = initial + actualSaved;
      }
      setSavingsTotal(totalSaved);

    } catch (err) {
      console.error("Error loading dashboard data:", err);
    }
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    if (uid) {
      loadData();
    }
  }, [uid, loadData]);

  // Persistent Scratchpad
  useEffect(() => {
    if (typeof window !== "undefined") {
      setScratchpad(localStorage.getItem("dashboard_scratchpad") || "");
    }
  }, []);

  const handleScratchpadChange = (val: string) => {
    setScratchpad(val);
    localStorage.setItem("dashboard_scratchpad", val);
  };

  // ── Operations Quick Actions ──
  
  // Toggle mission checklist item
  const toggleMissionChecklistItem = async (missionId: string, itemId: string) => {
    if (!uid) return;
    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;

    const updatedChecklist = mission.checklist.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    const completedCount = updatedChecklist.filter(item => item.completed).length;
    const totalCount = updatedChecklist.length;
    const newProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const newStatus = newProgress === 100 ? "COMPLETED" as const : mission.status;

    // Zero-latency local update
    setMissions(prev =>
      prev.map(m =>
        m.id === missionId
          ? { ...m, checklist: updatedChecklist, progress: newProgress, status: newStatus }
          : m
      )
    );

    try {
      await update<Mission>(uid, "missions", missionId, {
        checklist: updatedChecklist,
        progress: newProgress,
        status: newStatus,
      });
    } catch (err) {
      console.error("Error updating mission checklist:", err);
    }
  };

  // Update TimeBlock execution status
  const updateBlockStatus = async (blockId: string, status: BlockStatus) => {
    if (!uid) return;
    
    // Zero-latency local update
    setTimeBlocks(prev =>
      prev.map(b => (b.id === blockId ? { ...b, executedStatus: status } : b))
    );

    try {
      await update<TimeBlock>(uid, "timeBlocks", blockId, { executedStatus: status });
    } catch (err) {
      console.error("Error updating block status:", err);
    }
  };

  // ── Strategic Computations ──
  const activeGoals = goals.filter((g) => g.status !== "COMPLETED" && g.status !== "CANCELLED");
  const completedGoals = goals.filter((g) => g.status === "COMPLETED");
  const activeMissions = missions.filter((m) => m.status !== "COMPLETED" && m.status !== "FAILED");

  const avgGoalProgress = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length)
    : 0;

  const hasData = goals.length > 0 || missions.length > 0;

  // ── Finance Computations ──
  const currentMonth = monthInMexicoCity();
  
  const totalMinPayment = debts
    .filter((d) => d.status === "ACTIVE")
    .reduce((sum, d) => sum + d.minimumPayment, 0);

  const monthlyIncomesList = currentMonth >= "2026-03"
    ? resolveIncomesForMonth(incomes, currentMonth, "PERSONAL")
    : [];

  const monthlyExpensesList = currentMonth >= "2026-03"
    ? resolveExpensesForMonth(expenses, currentMonth).filter(
        (expense) =>
          (expense.financialContext || "PERSONAL") === "PERSONAL",
      )
    : [];

  const totalIncome = monthlyIncomesList.reduce((s, i) => s + i.netIncome, 0);
  const totalExpenses = monthlyExpensesList.reduce((s, e) => s + e.amount, 0) + totalMinPayment;
  const totalDebt = debts
    .filter((d) => d.status === "ACTIVE")
    .reduce((s, d) => s + d.currentBalance, 0);
  const netBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netBalance / totalIncome) * 100) : 0;

  // Recharts: últimos seis meses con datos asignados a su periodo real.
  const months = Array.from({ length: 6 }, (_, index) =>
    addMonthsToMonthKey(currentMonth, index - 5),
  ).filter((month) => month >= "2026-03");

  const chartData = months.map(m => {
    const incSum = resolveIncomesForMonth(incomes, m, "PERSONAL")
      .reduce((sum, income) => sum + income.netIncome, 0);
    const expSum = resolveExpensesForMonth(expenses, m)
      .filter(
        (expense) =>
          (expense.financialContext || "PERSONAL") === "PERSONAL",
      )
      .reduce((sum, expense) => sum + Math.max(0, expense.amount || 0), 0) +
      (m === currentMonth ? totalMinPayment : 0);
    
    const [year, monthStr] = m.split("-");
    const date = new Date(parseInt(year), parseInt(monthStr) - 1, 1);
    const name = date.toLocaleDateString("es-MX", { month: "short" });

    return {
      month: m,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      Ingresos: incSum,
      Gastos: expSum,
      Ahorro: Math.max(0, incSum - expSum),
    };
  });

  // ── Timeline details ──
  const todayKey = getDayKey(now);
  const currentWeekId = getISOWeek(now);
  const todayBlocks = timeBlocks
    .filter(b => b.weekId === currentWeekId && b.day === todayKey)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const isBlockActive = (b: TimeBlock) => {
    const currentHourStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    return currentHourStr >= b.startTime && currentHourStr <= b.endTime;
  };

  const getActiveBlockLabel = () => {
    const active = todayBlocks.find(isBlockActive);
    return active ? `En curso: ${active.title}` : "Sin bloques activos ahora";
  };

  if (loading) {
    return (
      <div className="page-enter space-y-6">
        <div className="h-10 w-64 skeleton" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 skeleton rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[450px] skeleton rounded-3xl" />
          <div className="h-[450px] skeleton rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-8 pb-10">
      
      {/* ── HERO HEADER ─────────────────────── */}
      <div className="flex flex-col items-center text-center lg:flex-row lg:items-center lg:text-left lg:justify-between mb-2 mt-4 gap-4">
        <div className="flex flex-col items-center lg:flex-row lg:items-center gap-4">
          <div className="hero-icon-box lg:mb-0 relative" style={{ animation: "float 6s ease-in-out infinite" }}>
            <Sparkles className="w-10 h-10 text-amber-400" />
            <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full" />
          </div>
          <div>
            <h1 className="hero-title lg:text-3xl lg:mb-1">
              Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 font-black">Brandon</span>
            </h1>
            <p className="hero-subtitle lg:text-left lg:mx-0">
              {now.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
        
        {/* Operations pill widget */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-white/[0.03] border border-white/[0.05] rounded-2xl px-4 py-2.5">
            <Zap className={`w-3.5 h-3.5 ${todayBlocks.find(isBlockActive) ? "text-amber-400 animate-pulse" : "text-zinc-600"}`} />
            <span className="font-medium truncate max-w-[200px]">{getActiveBlockLabel()}</span>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-500 bg-zinc-950/30 border border-white/[0.04] rounded-2xl px-4 py-2.5">
            <span className="pulse-dot w-2 h-2 rounded-full bg-emerald-400" />
            <span>Base de datos activa</span>
          </div>
        </div>
      </div>

      {/* ── PREMIUM NAVIGATION TABS ─────────────────────── */}
      <div className="flex gap-2 bg-zinc-950/50 p-1.5 border border-white/[0.05] rounded-[24px] select-none shadow-2xl relative overflow-hidden backdrop-blur-2xl">
        {[
          { key: "operaciones", label: "Operaciones", icon: ListChecks, activeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-purple-500/5" },
          { key: "estrategia", label: "Estrategia", icon: Trophy, activeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/5" },
          { key: "finanzas", label: "Finanzas", icon: Wallet, activeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5" },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-[18px] text-xs font-black transition-all duration-300 ${
                isActive
                  ? `${tab.activeColor} border text-[13px] shadow-[0_0_20px]`
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
              }`}
            >
              <TabIcon className="w-4 h-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════
          TAB 1: OPERACIONES (Daily focus)
      ══════════════════════════════════════ */}
      {activeTab === "operaciones" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Today's Timeline Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-6 border-white/[0.04] bg-[#0c0c0e]/60">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.05)]">
                    <Calendar className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-wider">Cronograma de Hoy</h2>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Gestión y control de bloques del día</p>
                  </div>
                </div>
                <Link href="/agenda" className="text-[10px] text-zinc-400 hover:text-purple-400 font-bold bg-white/5 border border-white/5 hover:border-purple-500/20 hover:bg-purple-500/10 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1">
                  Editar Agenda <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {/* Timeline layout */}
              <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
                {todayBlocks.length > 0 ? (
                  todayBlocks.map((block) => {
                    const cfg = CATEGORY_CONFIG[block.category] || CATEGORY_CONFIG.TRABAJO;
                    const BlockIcon = cfg.icon;
                    const active = isBlockActive(block);
                    
                    return (
                      <div
                        key={block.id}
                        className={`flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 ${cfg.bg} ${
                          active
                            ? "border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.06)] relative overflow-visible"
                            : "border-white/[0.03]"
                        }`}
                      >
                        {/* Current indicator glow */}
                        {active && (
                          <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-purple-500 rounded-full border-2 border-black animate-ping shadow-[0_0_10px_purple]" />
                        )}

                        {/* Category Left Bar & Icon */}
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${cfg.text} bg-zinc-950/40 border-white/5`}>
                          <BlockIcon className="w-4.5 h-4.5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] font-mono font-bold text-zinc-400">{block.startTime} - {block.endTime}</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border ${
                              block.executedStatus === "COMPLETED"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                                : block.executedStatus === "SKIPPED"
                                ? "bg-red-500/15 text-red-400 border-red-500/25"
                                : "bg-zinc-500/10 text-zinc-400 border-white/5"
                            }`}>
                              {block.executedStatus === "COMPLETED" ? "Completado" : block.executedStatus === "SKIPPED" ? "Saltado" : "Pendiente"}
                            </span>
                          </div>
                          
                          <p className={`text-xs font-bold text-zinc-100 ${block.executedStatus === "COMPLETED" ? "line-through text-zinc-500" : ""}`}>
                            {block.title}
                          </p>

                          {/* Quick Interactive Actions */}
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.03]">
                            <p className="text-[9px] uppercase font-bold text-zinc-500 mr-2 tracking-wider">Estado:</p>
                            <button
                              onClick={() => updateBlockStatus(block.id, "COMPLETED")}
                              className={`flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-lg transition-all border ${
                                block.executedStatus === "COMPLETED"
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                  : "bg-white/5 text-zinc-400 border-white/5 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20"
                              }`}
                            >
                              <Check className="w-3 h-3" /> Completar
                            </button>
                            <button
                              onClick={() => updateBlockStatus(block.id, "SKIPPED")}
                              className={`flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-lg transition-all border ${
                                block.executedStatus === "SKIPPED"
                                  ? "bg-red-500/20 text-red-300 border-red-500/30"
                                  : "bg-white/5 text-zinc-400 border-white/5 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20"
                              }`}
                            >
                              <X className="w-3 h-3" /> Saltar
                            </button>
                            {block.executedStatus !== "PLANNED" && (
                              <button
                                onClick={() => updateBlockStatus(block.id, "PLANNED")}
                                className="text-[9px] text-zinc-500 hover:text-zinc-300 font-semibold underline px-2"
                              >
                                Restablecer
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-16 border border-dashed border-white/5 rounded-3xl bg-white/[0.01] flex flex-col items-center justify-center">
                    <Calendar className="w-10 h-10 text-zinc-700 mb-3" />
                    <p className="text-xs font-bold text-zinc-400">Sin bloques de tiempo hoy</p>
                    <p className="text-[10px] text-zinc-600 max-w-[240px] mt-1 text-center">
                      Ve a tu agenda semanal para configurar tu rutina diaria ideal o cargar una plantilla base.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Mission Checklist & Scratchpad Column */}
          <div className="space-y-6">
            
            {/* Missions check-in */}
            <div className="glass-card p-6 border-white/[0.04] bg-[#0c0c0e]/60 flex flex-col min-h-[280px]">
              <div className="flex items-center justify-between pb-3.5 border-b border-white/5 mb-4">
                <div className="flex items-center gap-2.5">
                  <Swords className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Checklist Misiones</h3>
                </div>
                <Link href="/misiones" className="text-[9px] text-zinc-500 hover:text-purple-400 font-bold bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg">
                  Misiones
                </Link>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[220px] pr-1 space-y-4 custom-scrollbar">
                {activeMissions.length > 0 ? (
                  activeMissions.slice(0, 2).map((mission) => (
                    <div key={mission.id} className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-2xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black text-zinc-300 truncate max-w-[150px]">{mission.name}</span>
                        <span className="text-[10px] font-bold font-mono text-purple-400">{mission.progress}%</span>
                      </div>
                      
                      {/* Sub-checklist items */}
                      <div className="space-y-1.5 mt-2.5">
                        {mission.checklist.length > 0 ? (
                          mission.checklist.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => toggleMissionChecklistItem(mission.id, item.id)}
                              className="flex items-start gap-2.5 px-2.5 py-2 hover:bg-white/[0.02] border border-transparent hover:border-white/5 rounded-xl cursor-pointer select-none transition-all group"
                            >
                              <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                item.completed
                                  ? "bg-purple-500 border-purple-500 text-black font-black"
                                  : "border-white/20 group-hover:border-purple-500/40"
                              }`}>
                                {item.completed && <Check className="w-3 h-3 text-black stroke-[3px]" />}
                              </div>
                              <span className={`text-[10.5px] leading-tight font-medium ${
                                item.completed ? "text-zinc-500 line-through" : "text-zinc-300 group-hover:text-white"
                              }`}>
                                {item.text}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-zinc-600 italic px-2 py-1">Misión sin checklist operativo.</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 flex flex-col items-center justify-center h-full">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/20 mb-2" />
                    <p className="text-[11px] font-bold text-zinc-400">Sin misiones activas</p>
                    <p className="text-[9px] text-zinc-600 mt-1 max-w-[160px] mx-auto">Toma el control agendando una misión clave.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Daily scratchpad */}
            <div className="glass-card p-6 border-white/[0.04] bg-[#0c0c0e]/60 flex flex-col h-[230px]">
              <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3.5 select-none">
                <div className="flex items-center gap-2.5">
                  <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Brain Dump (Bloc Diario)</h3>
                </div>
                <span className="text-[8px] bg-zinc-800 text-zinc-500 border border-white/5 px-2 py-0.5 rounded uppercase font-bold tracking-widest">Local</span>
              </div>
              <textarea
                value={scratchpad}
                onChange={(e) => handleScratchpadChange(e.target.value)}
                placeholder="Escribe tus notas, tareas rápidas o pensamientos temporales aquí... se auto-guardarán."
                className="flex-1 w-full bg-zinc-950/30 border border-white/5 hover:border-white/10 focus:border-purple-500/40 rounded-xl p-3 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none resize-none transition-colors"
              />
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 2: ESTRATEGIA (Goals & alerts)
      ══════════════════════════════════════ */}
      {activeTab === "estrategia" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Circular SVG Goal Meter Column */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card p-6 border-white/[0.04] bg-[#0c0c0e]/60 text-center flex flex-col items-center justify-center">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-6 w-full text-left">Promedio Estratégico</h3>
              
              {/* Circular Gauge */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    stroke="#18181b"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    stroke="url(#gradientAmber)"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 60}`}
                    strokeDashoffset={`${2 * Math.PI * 60 * (1 - avgGoalProgress / 100)}`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="gradientAmber" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#f97316" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                    {avgGoalProgress}%
                  </span>
                  <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-widest mt-0.5">Meta General</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full mt-8 pt-6 border-t border-white/5">
                <div className="text-left">
                  <p className="text-lg font-bold font-mono text-zinc-200">{activeGoals.length}</p>
                  <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mt-0.5">Metas Activas</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold font-mono text-emerald-400">{completedGoals.length}</p>
                  <p className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider mt-0.5">Completadas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Strategic alerts & Goals List */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Intelligent alerts */}
            <div className="glass-card p-6 border-white/[0.04] bg-[#0c0c0e]/60">
              <div className="flex items-center justify-between pb-3.5 border-b border-white/5 mb-4">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Alertas de Ejecución</h3>
                </div>
                {alerts.length > 0 && (
                  <span className="text-[9px] font-bold bg-zinc-800 text-zinc-300 border border-white/5 px-2.5 py-0.5 rounded-full">
                    {alerts.length} Totales
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {alerts.length > 0 ? (
                  alerts.slice(0, 3).map((a) => (
                    <AlertCard key={a.id} alert={a} />
                  ))
                ) : (
                  <div className="text-center py-10 flex flex-col items-center justify-center">
                    <CheckCircle2 className="w-9 h-9 text-emerald-500/20 mb-2.5" />
                    <p className="text-xs font-bold text-zinc-300">¡Todo en orden!</p>
                    <p className="text-[10px] text-zinc-500 mt-1 max-w-[200px]">Tus métricas de metas y misiones están balanceadas.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Active Goals with custom progress */}
            <div className="glass-card p-6 border-white/[0.04] bg-[#0c0c0e]/60">
              <div className="flex items-center justify-between pb-3.5 border-b border-white/5 mb-4">
                <div className="flex items-center gap-2.5">
                  <Target className="w-4.5 h-4.5 text-amber-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Progreso Reciente</h3>
                </div>
                <Link href="/estrategia/metas" className="text-[9px] font-bold text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1">
                  Ver Todas <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {activeGoals.length > 0 ? (
                  activeGoals.slice(0, 4).map((goal) => (
                    <div key={goal.id} className="p-3 hover:bg-white/[0.01] rounded-xl border border-transparent hover:border-white/5 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-zinc-200 truncate pr-4">{goal.name}</span>
                        <span className={`badge text-[9px] py-0 px-2 leading-none shrink-0 ${getStatusColor(goal.status)}`}>
                          {goal.status.replace("_", " ")}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex-1 progress-bar h-1.5 bg-zinc-900 border border-white/5">
                          <div
                            className="progress-bar-fill shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                            style={{ width: `${goal.progress}%`, ...(goal.progress === 100 ? { background: "#10b981" } : {}) }}
                          />
                        </div>
                        <span className={`text-[10px] font-mono font-bold min-w-[32px] text-right ${goal.progress === 100 ? "text-emerald-400" : "text-zinc-400"}`}>
                          {formatPercent(goal.progress)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 flex flex-col items-center justify-center">
                    <Trophy className="w-9 h-9 text-zinc-700 mb-2" />
                    <p className="text-xs font-bold text-zinc-400">Sin metas registradas</p>
                    <p className="text-[10px] text-zinc-500 mt-1">Crea tus objetivos estratégicos para habilitar el trackeo.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 3: FINANZAS (Wealth tracking)
      ══════════════════════════════════════ */}
      {activeTab === "finanzas" && (
        <div className="space-y-6">
          
          {/* Key Finance Stats Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Balance Neto */}
            <div className={`glass-card p-5 border bg-[#0c0c0e]/80 transition-all duration-300 ${
              netBalance >= 0 
                ? "border-emerald-500/10 hover:border-emerald-500/20 shadow-[0_4px_20px_rgba(16,185,129,0.02)]" 
                : "border-red-500/10 hover:border-red-500/20 shadow-[0_4px_20px_rgba(239,68,68,0.02)]"
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${netBalance >= 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="text-[9px] uppercase font-bold text-zinc-500 font-mono">Mes en Curso</span>
              </div>
              <p className={`text-2xl font-black font-mono tracking-tight ${netBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatCurrency(netBalance)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1 font-semibold uppercase tracking-wider">Balance Neto</p>
              <p className="text-[9px] text-zinc-600 mt-0.5 font-medium">Ingresos menos gastos actuales</p>
            </div>

            {/* Tasa de Ahorro */}
            <div className={`glass-card p-5 border bg-[#0c0c0e]/80 transition-all duration-300 border-amber-500/10 hover:border-amber-500/20 shadow-[0_4px_20px_rgba(245,158,11,0.02)]`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="text-[9px] uppercase font-bold text-zinc-500 font-mono">Salud Financiera</span>
              </div>
              <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
                {savingsRate}%
              </p>
              <p className="text-[10px] text-zinc-500 mt-1 font-semibold uppercase tracking-wider">Tasa de Ahorro</p>
              <p className="text-[9px] text-zinc-600 mt-0.5 font-medium">Saludable: mínimo 20%</p>
            </div>

            {/* Total Ahorrado */}
            <div className={`glass-card p-5 border bg-[#0c0c0e]/80 transition-all duration-300 border-blue-500/10 hover:border-blue-500/20 shadow-[0_4px_20px_rgba(59,130,246,0.02)]`}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-400 border-blue-500/20">
                  <PiggyBank className="w-4 h-4" />
                </div>
                <span className="text-[9px] uppercase font-bold text-zinc-500 font-mono">Acumulado</span>
              </div>
              <p className="text-2xl font-black font-mono tracking-tight text-blue-400">
                {formatCurrency(savingsTotal)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1 font-semibold uppercase tracking-wider">Patrimonio Ahorrado</p>
              <p className="text-[9px] text-zinc-600 mt-0.5 font-medium">Ahorros y fondos acumulados</p>
            </div>

          </div>

          {/* Gráfico Financiero de Recharts */}
          <div className="glass-card p-6 border-white/[0.04] bg-[#0c0c0e]/60">
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ArrowUpRight className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Tendencia de Flujo de Caja</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Historial comparativo de ingresos vs gastos reales</p>
                </div>
              </div>
              
              <Link href="/finanzas" className="text-[10px] text-zinc-400 hover:text-emerald-400 font-bold bg-white/5 border border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/10 px-3 py-1.5 rounded-xl transition-all">
                Control Financiero
              </Link>
            </div>

            {/* Recharts Area Chart */}
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIngresos" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorGastos" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#ffffff" strokeOpacity={0.03} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    stroke="#52525b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#52525b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `$${val / 1000}k`}
                  />
                  <ChartTooltip
                    contentStyle={{
                      backgroundColor: "#09090b",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "16px",
                      fontSize: "11px",
                      color: "#f4f4f5",
                    }}
                    formatter={(value) => [formatCurrency(Number(value)), ""]}
                  />
                  <Area
                    type="monotone"
                    dataKey="Ingresos"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorIngresos)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Gastos"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorGastos)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Active Debts Grid */}
          <div className="glass-card p-6 border-white/[0.04] bg-[#0c0c0e]/60">
            <div className="flex items-center justify-between pb-3.5 border-b border-white/5 mb-4 select-none">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Pasivos y Amortizaciones</h3>
              </div>
              <span className="text-[10px] text-zinc-500 font-bold font-mono">Deuda Total: {formatCurrency(totalDebt)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {debts.filter(d => d.status === "ACTIVE").length > 0 ? (
                debts
                  .filter(d => d.status === "ACTIVE")
                  .map((debt) => (
                    <div key={debt.id} className="p-4 rounded-2xl bg-zinc-950/40 border border-white/[0.03] flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-zinc-200">{debt.entity}</p>
                        <p className="text-[9px] text-zinc-500 mt-1 uppercase tracking-wider font-semibold">Corte: Día {debt.cutoffDate} · Pago Mín: {formatCurrency(debt.minimumPayment)}</p>
                      </div>
                      <span className="text-sm font-black font-mono text-orange-400">{formatCurrency(debt.currentBalance)}</span>
                    </div>
                  ))
              ) : (
                <div className="sm:col-span-2 text-center py-8">
                  <p className="text-[11px] font-bold text-zinc-500">✨ ¡Felicidades! Estás libre de deudas activas registrados.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── BENTO QUICK NAVIGATION ACTIONS ─────────────────────── */}
      {hasData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mt-8 select-none">
          {[
            { label: "Planificador de Hábitos", href: "/planificador", icon: Target, color: "from-amber-500 to-orange-500", glow: "shadow-amber-500/10" },
            { label: "Nueva Meta Estratégica", href: "/estrategia/metas", icon: Trophy, color: "from-emerald-400 to-emerald-600", glow: "shadow-emerald-500/10" },
            { label: "Nueva Misión Diaria", href: "/misiones", icon: Swords, color: "from-purple-400 to-purple-600", glow: "shadow-purple-500/10" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="glass-card p-5 lg:p-6 flex flex-col items-center justify-center gap-4 group text-center"
            >
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${action.color} border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-xl group-hover:${action.glow} group-hover:shadow-[0_0_20px]`}>
                <action.icon className="w-5 h-5 text-black" />
              </div>
              <span className="text-xs font-black text-zinc-300 group-hover:text-white tracking-wider uppercase">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      )}

    </div>
  );
}
