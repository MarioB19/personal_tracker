"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { getAll, getAllFinance } from "@/lib/repositories/firestore";
import { Goal, Mission, TimeBlock, Income, Expense, Review, DayOfWeek, BlockCategory, SelfEvaluations, Debt } from "@/lib/types";
import { 
  BarChart3, Target, Clock, Wallet, Trophy, Zap, Calendar, 
  ArrowUpRight, ArrowDownRight, Compass, ShieldAlert, Sparkles, 
  ChevronLeft, ChevronRight, Eye, Percent, TrendingUp, Info, CreditCard
} from "lucide-react";
import { formatCurrency, formatPercent, cn, normalizeActivityName } from "@/lib/utils";
import {
  addMonthsToMonthKey,
  resolveExpensesForMonth,
  resolveIncomesForMonth,
} from "@/lib/finance/business-metrics";
import { monthInMexicoCity } from "@/lib/time/month";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, ReferenceLine
} from "recharts";

// Helper function to calculate duration in hours between two time strings "HH:MM"
function parseTimeToHours(start: string, end: string): number {
  try {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
    return (eh + em / 60) - (sh + sm / 60);
  } catch {
    return 0;
  }
}

// Convert weekId ("YYYY-Www") and day (DayOfWeek) to exact Date
function getDateFromWeekAndDay(weekId: string, day: DayOfWeek): Date {
  try {
    const parts = weekId.split("-W");
    if (parts.length !== 2) return new Date();
    const year = parseInt(parts[0], 10);
    const week = parseInt(parts[1], 10);

    // Find the first day of the year
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = new Date(simple);
    
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }

    const dayOffsets: Record<DayOfWeek, number> = {
      MON: 0,
      TUE: 1,
      WED: 2,
      THU: 3,
      FRI: 4,
      SAT: 5,
      SUN: 6
    };
    
    const offset = dayOffsets[day] || 0;
    const result = new Date(ISOweekStart);
    result.setDate(ISOweekStart.getDate() + offset);
    return result;
  } catch {
    return new Date();
  }
}

const CHART_COLORS = ["#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#f97316", "#14b8a6", "#ef4444"];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md text-xs">
      <p className="text-zinc-500 font-bold uppercase tracking-wider mb-2 text-[9px]">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-3 justify-between py-0.5">
          <span className="text-zinc-400 font-medium">{p.name}:</span>
          <span className="text-zinc-100 font-black font-mono">
            {p.name.includes("Ingreso") || p.name.includes("Gasto") || p.name.includes("Balance")
              ? formatCurrency(p.value)
              : typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const DIMENSIONS_CONFIG = [
  { key: "yoFisico", label: "Yo Físico", color: "from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/20" },
  { key: "yoProfesional", label: "Yo Profesional", color: "from-blue-500/20 to-blue-600/5 text-blue-400 border-blue-500/20" },
  { key: "yoEmprendedor", label: "Yo Emprendedor", color: "from-violet-500/20 to-violet-600/5 text-violet-400 border-violet-500/20" },
  { key: "yoMental", label: "Yo Mental", color: "from-pink-500/20 to-pink-600/5 text-pink-400 border-pink-500/20" },
  { key: "yoRelacional", label: "Yo Relacional", color: "from-indigo-500/20 to-indigo-600/5 text-indigo-400 border-indigo-500/20" },
  { key: "yoEspiritual", label: "Yo Espiritual", color: "from-teal-500/20 to-teal-600/5 text-teal-400 border-teal-500/20" },
  { key: "yoProposito", label: "Yo Propósito", color: "from-amber-500/20 to-amber-600/5 text-amber-400 border-amber-500/20" },
];

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const FINANCE_TRACKING_START_MONTH = "2026-03";

export default function AnaliticaPage() {
  const { user } = useAuth();
  const uid = useUid();

  // Raw Database States
  const [goals, setGoals] = useState<Goal[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States (HUD)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [isHistorical, setIsHistorical] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!uid) return;
    try {
      const [g, m, tb, inc, exp, revs, dbt] = await Promise.all([
        getAll<Goal>(uid, "goals"),
        getAll<Mission>(uid, "missions"),
        getAll<TimeBlock>(uid, "timeBlocks"),
        getAllFinance<Income>(uid, "income"),
        getAllFinance<Expense>(uid, "expenses"),
        getAll<Review>(uid, "reviews"),
        getAllFinance<Debt>(uid, "debts"),
      ]);
      setGoals(g);
      setMissions(m);
      setTimeBlocks(tb);
      setIncomes(inc);
      setExpenses(exp);
      setReviews(revs);
      setDebts(dbt);
    } catch (error) {
      console.error("Error loading analytics data:", error);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) {
      loadData();
    }
  }, [uid, loadData]);

  // Selected Month Key for Filtering Incomes/Expenses ("YYYY-MM")
  const currentMonthKey = useMemo(() => {
    return `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  }, [selectedYear, selectedMonth]);
  const liveMonthKey = monthInMexicoCity();
  const historicalMonthKeys = useMemo(() => {
    const months: string[] = [];
    let cursor = FINANCE_TRACKING_START_MONTH;
    while (cursor <= liveMonthKey && months.length < 600) {
      months.push(cursor);
      cursor = addMonthsToMonthKey(cursor, 1);
    }
    return months;
  }, [liveMonthKey]);

  // Previous Month Key for comparing Trend Balance
  const prevMonthKey = useMemo(() => {
    let prevM = selectedMonth - 1;
    let prevY = selectedYear;
    if (prevM === 0) {
      prevM = 12;
      prevY -= 1;
    }
    return `${prevY}-${String(prevM).padStart(2, "0")}`;
  }, [selectedYear, selectedMonth]);

  // ==========================================
  // DYNAMIC FILTERING ENGINE
  // ==========================================

  // 1. Incomes & Expenses (applied to all active tracking months starting from March 2026)
  const filteredIncomes = useMemo(() => {
    if (isHistorical) {
      return historicalMonthKeys.flatMap((month) =>
        resolveIncomesForMonth(incomes, month, "PERSONAL").map((income) => ({
          ...income,
          id: `${month}:${income.id}`,
        })),
      );
    }
    if (
      currentMonthKey < FINANCE_TRACKING_START_MONTH ||
      currentMonthKey > liveMonthKey
    ) return [];
    return resolveIncomesForMonth(incomes, currentMonthKey, "PERSONAL");
  }, [incomes, isHistorical, currentMonthKey, historicalMonthKeys, liveMonthKey]);

  const filteredExpenses = useMemo(() => {
    if (isHistorical) {
      return historicalMonthKeys.flatMap((month) =>
        resolveExpensesForMonth(expenses, month)
          .filter(
            (expense) =>
              (expense.financialContext || "PERSONAL") === "PERSONAL",
          )
          .map((expense) => ({
            ...expense,
            id: `${month}:${expense.id}`,
          })),
      );
    }
    if (
      currentMonthKey < FINANCE_TRACKING_START_MONTH ||
      currentMonthKey > liveMonthKey
    ) return [];
    return resolveExpensesForMonth(expenses, currentMonthKey).filter(
      (expense) =>
        (expense.financialContext || "PERSONAL") === "PERSONAL",
    );
  }, [expenses, currentMonthKey, historicalMonthKeys, isHistorical, liveMonthKey]);

  // 2. Goals
  const filteredGoals = useMemo(() => {
    if (isHistorical) return goals;
    return goals.filter(goal => {
      // Direct Monthly assignment
      if (goal.period === "MONTHLY" && goal.month === selectedMonth && goal.year === selectedYear) {
        return true;
      }
      // Direct Quarterly assignment
      if (goal.period === "QUARTERLY" && goal.quarter === Math.ceil(selectedMonth / 3) && goal.year === selectedYear) {
        return true;
      }
      // Direct Annual assignment
      if (goal.period === "ANNUAL" && goal.year === selectedYear) {
        return true;
      }
      // Fallback on targetDate
      if (goal.targetDate) {
        try {
          const d = goal.targetDate.toDate();
          return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
        } catch {
          return false;
        }
      }
      return false;
    });
  }, [goals, isHistorical, selectedMonth, selectedYear]);

  // 3. Missions
  const filteredMissions = useMemo(() => {
    if (isHistorical) return missions;
    return missions.filter(m => {
      if (!m.targetDate) return false;
      try {
        const d = m.targetDate.toDate();
        return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
      } catch {
        return false;
      }
    });
  }, [missions, isHistorical, selectedMonth, selectedYear]);

  // 4. TimeBlocks (ISO Week resolution)
  const filteredTimeBlocks = useMemo(() => {
    if (isHistorical) return timeBlocks;
    return timeBlocks.filter(tb => {
      const d = getDateFromWeekAndDay(tb.weekId, tb.day as DayOfWeek);
      return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
    });
  }, [timeBlocks, isHistorical, selectedMonth, selectedYear]);

  // 5. Reviews
  const filteredReviews = useMemo(() => {
    if (isHistorical) return reviews;
    return reviews.filter(r => {
      if (!r.createdAt) return false;
      try {
        const d = r.createdAt.toDate();
        return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
      } catch {
        return false;
      }
    });
  }, [reviews, isHistorical, selectedMonth, selectedYear]);

  // ==========================================
  // METRICS COMPUTATION (KPI CARDS)
  // ==========================================

  // E. Debts (Leverage metrics - defined early for scope)
  const totalActiveDebt = debts.filter(d => d.status === "ACTIVE").reduce((sum, d) => sum + d.currentBalance, 0);
  const totalMinPayment = debts.filter(d => d.status === "ACTIVE").reduce((sum, d) => sum + d.minimumPayment, 0);

  // A. Goals Completion
  const totalGoalsCount = filteredGoals.length;
  const completedGoalsCount = filteredGoals.filter(g => g.status === "COMPLETED").length;
  const goalsCompletionRate = totalGoalsCount > 0 ? (completedGoalsCount / totalGoalsCount) * 100 : 0;

  // B. Financial Balance
  const totalIncomeValue = filteredIncomes.reduce((sum, i) => sum + i.netIncome, 0);
  // Debt records do not preserve an activation/cancellation timeline, so the
  // current minimum payment only belongs to the live CDMX month. Historical
  // mode aggregates that point-in-time obligation exactly once.
  const applicableMinimumDebtPayment =
    isHistorical || currentMonthKey === liveMonthKey ? totalMinPayment : 0;
  const totalExpenseValue =
    filteredExpenses.reduce((sum, e) => sum + e.amount, 0) +
    applicableMinimumDebtPayment;
  const monthlyBalanceValue = totalIncomeValue - totalExpenseValue;
  const savingsRate = totalIncomeValue > 0 ? (monthlyBalanceValue / totalIncomeValue) * 100 : 0;
  const historicalDayCount = historicalMonthKeys.reduce((days, monthKey) => {
    const [year, month] = monthKey.split("-").map(Number);
    return days + new Date(year, month, 0).getDate();
  }, 0);
  const averageDailySpend = !isHistorical
    ? (totalExpenseValue / new Date(selectedYear, selectedMonth, 0).getDate())
    : (totalExpenseValue / Math.max(1, historicalDayCount));
  
  // Previous Month balance (for trend calculations)
  const prevMonthIncomes = prevMonthKey >= FINANCE_TRACKING_START_MONTH
    ? resolveIncomesForMonth(incomes, prevMonthKey, "PERSONAL")
    : [];
  const prevMonthExpenses = prevMonthKey >= FINANCE_TRACKING_START_MONTH
    ? resolveExpensesForMonth(expenses, prevMonthKey).filter(
        (expense) =>
          (expense.financialContext || "PERSONAL") === "PERSONAL",
      )
    : [];
  const prevMonthMinimumDebtPayment =
    prevMonthKey === liveMonthKey ? totalMinPayment : 0;
  const prevMonthBalance =
    prevMonthIncomes.reduce((s, i) => s + i.netIncome, 0) -
    (prevMonthExpenses.reduce((s, e) => s + e.amount, 0) +
      prevMonthMinimumDebtPayment);
  const balanceTrendIsUp = monthlyBalanceValue >= prevMonthBalance;

  // C. Missions Completion
  const totalMissionsCount = filteredMissions.length;
  const completedMissionsCount = filteredMissions.filter(m => m.status === "COMPLETED").length;
  const missionsCompletionRate = totalMissionsCount > 0 ? (completedMissionsCount / totalMissionsCount) * 100 : 0;

  // D. Time Block Efficiency
  const plannedTimeBlocksCount = filteredTimeBlocks.length;
  const completedTimeBlocksCount = filteredTimeBlocks.filter(tb => tb.executedStatus === "COMPLETED").length;
  const timeBlockEfficiency = plannedTimeBlocksCount > 0 ? (completedTimeBlocksCount / plannedTimeBlocksCount) * 100 : 0;
  
  // Calculate total hours planned vs executed
  const totalHoursPlanned = filteredTimeBlocks.reduce((sum, tb) => sum + parseTimeToHours(tb.startTime, tb.endTime), 0);
  const totalHoursExecuted = filteredTimeBlocks.filter(tb => tb.executedStatus === "COMPLETED").reduce((sum, tb) => sum + parseTimeToHours(tb.startTime, tb.endTime), 0);

  // ==========================================
  // VISUAL CHARTS PREPARATION
  // ==========================================

  // Chart 1: Financial Trend (Area Chart for Selected Year - with constant propagation)
  const trendData = useMemo(() => {
    const monthlyDataMap: Record<number, { name: string; income: number; expense: number }> = {};
    for (let i = 0; i < 12; i++) {
      monthlyDataMap[i] = { name: MONTH_SHORT[i], income: 0, expense: 0 };
    }
    
    for (let mIdx = 0; mIdx < 12; mIdx++) {
      const monthKey = `${selectedYear}-${String(mIdx + 1).padStart(2, "0")}`;
      if (
        monthKey >= FINANCE_TRACKING_START_MONTH &&
        monthKey <= liveMonthKey
      ) {
        monthlyDataMap[mIdx].income = resolveIncomesForMonth(
          incomes,
          monthKey,
          "PERSONAL",
        )
          .reduce((sum, income) => sum + income.netIncome, 0);
        monthlyDataMap[mIdx].expense = resolveExpensesForMonth(expenses, monthKey)
          .filter(
            (expense) =>
              (expense.financialContext || "PERSONAL") === "PERSONAL",
          )
          .reduce((s, e) => s + e.amount, 0) +
          (monthKey === liveMonthKey ? totalMinPayment : 0);
      }
    }

    return Object.values(monthlyDataMap);
  }, [incomes, expenses, liveMonthKey, selectedYear, totalMinPayment]);

  // Active month name for drawing trend lines
  const activeMonthNameShort = MONTH_SHORT[selectedMonth - 1];

  // Chart 2: Expense Category Breakdown (Pie Chart)
  const expenseCategoryData = useMemo(() => {
    const categorySum = filteredExpenses.reduce<Record<string, number>>((acc, e) => {
      const cat = e.category || "OTRO";
      acc[cat] = (acc[cat] || 0) + e.amount;
      return acc;
    }, {});

    return Object.entries(categorySum)
      .map(([name, value], idx) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
        value,
        color: CHART_COLORS[idx % CHART_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // Chart 3: Time Block Hours Spent by Category (Double Bar Chart)
  const productivityData = useMemo(() => {
    const categories: BlockCategory[] = ["TRABAJO", "APRENDIZAJE", "SALUD", "PERSONAL", "OCIO"];
    const categoryMap: Record<BlockCategory, { category: string; planificadas: number; reales: number }> = {
      TRABAJO: { category: "Trabajo", planificadas: 0, reales: 0 },
      APRENDIZAJE: { category: "Aprendizaje", planificadas: 0, reales: 0 },
      SALUD: { category: "Salud", planificadas: 0, reales: 0 },
      PERSONAL: { category: "Personal", planificadas: 0, reales: 0 },
      OCIO: { category: "Ocio", planificadas: 0, reales: 0 },
    };

    filteredTimeBlocks.forEach(tb => {
      const duration = parseTimeToHours(tb.startTime, tb.endTime);
      if (categoryMap[tb.category]) {
        categoryMap[tb.category].planificadas += duration;
        if (tb.executedStatus === "COMPLETED") {
          categoryMap[tb.category].reales += duration;
        }
      }
    });

    return Object.values(categoryMap).filter(c => c.planificadas > 0);
  }, [filteredTimeBlocks]);

  // Chart 5: Homologated Activities Breakdown (Ranking of top consolidated activities)
  const homologatedActivitiesData = useMemo(() => {
    const map: Record<string, { name: string; category: BlockCategory; planificadas: number; reales: number }> = {};

    filteredTimeBlocks.forEach(tb => {
      const normName = normalizeActivityName(tb.title);
      const duration = parseTimeToHours(tb.startTime, tb.endTime);
      
      if (!map[normName]) {
        map[normName] = {
          name: normName,
          category: (tb.category as BlockCategory) || "PERSONAL",
          planificadas: 0,
          reales: 0,
        };
      }
      map[normName].planificadas += duration;
      if (tb.executedStatus === "COMPLETED") {
        map[normName].reales += duration;
      }
    });

    return Object.values(map).sort((a, b) => b.planificadas - a.planificadas);
  }, [filteredTimeBlocks]);

  // Chart 4: Self-Evaluations Balance of Life from reviews
  const selfEvalScores = useMemo(() => {
    const dimensions = [
      { key: "yoFisico", label: "Yo Físico", icon: "💪", class: "text-emerald-400" },
      { key: "yoProfesional", label: "Yo Profesional", icon: "💼", class: "text-blue-400" },
      { key: "yoEmprendedor", label: "Yo Emprendedor", icon: "🚀", class: "text-violet-400" },
      { key: "yoMental", label: "Yo Mental", icon: "🧠", class: "text-pink-400" },
      { key: "yoRelacional", label: "Yo Relacional", icon: "👥", class: "text-indigo-400" },
      { key: "yoEspiritual", label: "Yo Espiritual", icon: "✨", class: "text-teal-400" },
      { key: "yoProposito", label: "Yo Propósito", icon: "🎯", class: "text-amber-400" },
    ];

    const sums: Record<string, { total: number; count: number }> = {};
    dimensions.forEach(d => {
      sums[d.key] = { total: 0, count: 0 };
    });

    filteredReviews.forEach(r => {
      if (r.selfEvaluations) {
        dimensions.forEach(d => {
          const detail = r.selfEvaluations?.[d.key as keyof SelfEvaluations];
          if (detail && detail.rating > 0) {
            sums[d.key].total += detail.rating;
            sums[d.key].count += 1;
          }
        });
      }
    });

    return dimensions.map(d => {
      const s = sums[d.key];
      const avg = s.count > 0 ? Number((s.total / s.count).toFixed(1)) : 0;
      return {
        ...d,
        avgRating: avg,
        reviewCount: s.count
      };
    }).filter(d => d.avgRating > 0);
  }, [filteredReviews]);

  // HUD Navigation helpers
  const handlePrevMonth = () => {
    setSelectedMonth(prev => {
      if (prev === 1) {
        setSelectedYear(y => y - 1);
        return 12;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => {
      if (prev === 12) {
        setSelectedYear(y => y + 1);
        return 1;
      }
      return prev + 1;
    });
  };

  if (loading) {
    return (
      <div className="page-enter space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-9 w-48 bg-zinc-900 animate-pulse rounded-xl" />
          <div className="h-10 w-64 bg-zinc-900 animate-pulse rounded-xl" />
        </div>
        <div className="h-16 w-full bg-zinc-900/60 animate-pulse rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-zinc-900/50 animate-pulse rounded-2xl border border-zinc-900/40" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-[280px] bg-zinc-900/40 animate-pulse rounded-2xl lg:col-span-1 border border-zinc-900/30" />
          <div className="h-[280px] bg-zinc-900/40 animate-pulse rounded-2xl lg:col-span-2 border border-zinc-900/30" />
        </div>
      </div>
    );
  }

  const hasLoadedData = goals.length > 0 || incomes.length > 0 || expenses.length > 0 || timeBlocks.length > 0;

  return (
    <div className="page-enter space-y-6 pb-12">
      
      {/* ── HEADER & NAV HUD ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3 tracking-tight">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/15 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.05)]">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
            Analítica Inteligente
          </h1>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider font-semibold">
            {isHistorical ? "Análisis Histórico Global" : `Reporte Mensual: ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
          </p>
        </div>

        {/* View mode toggle: Monthly vs Historical */}
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-950/60 p-1.5 rounded-xl border border-zinc-800/80">
            <button
              onClick={() => setIsHistorical(false)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer uppercase tracking-wider",
                !isHistorical
                  ? "bg-zinc-900 text-amber-400 border border-zinc-800/60 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Mensual
            </button>
            <button
              onClick={() => setIsHistorical(true)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer uppercase tracking-wider",
                isHistorical
                  ? "bg-zinc-900 text-amber-400 border border-zinc-800/60 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Histórico
            </button>
          </div>

          {!isHistorical && (
            <div className="flex items-center gap-1 bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-1.5">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-zinc-200 px-3 select-none font-mono tracking-tight min-w-[90px] text-center">
                {MONTH_SHORT[selectedMonth - 1]}. {selectedYear}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── FILTER HUD: MONTH SELECTOR SLIDER (Only in Monthly mode) ──────────────────── */}
      {!isHistorical && (
        <div className="glass-card-static p-2.5 overflow-x-auto select-none custom-scrollbar border-zinc-800/80">
          <div className="flex gap-1.5 min-w-[800px] justify-between">
            {MONTH_NAMES.map((name, index) => {
              const isActive = selectedMonth === index + 1;
              return (
                <button
                  key={index}
                  onClick={() => setSelectedMonth(index + 1)}
                  className={cn(
                    "flex-1 py-2.5 px-2 text-[10px] uppercase tracking-wider font-extrabold rounded-xl transition-all duration-300 cursor-pointer",
                    isActive
                      ? "bg-gradient-to-br from-amber-500/20 to-amber-600/5 text-amber-400 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.08)] scale-[1.02]"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent"
                  )}
                >
                  {name.substring(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasLoadedData ? (
        <>
          {/* ── KPI GRID ───────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* KPI 1: Goals */}
            <div className="glass-card p-5 relative overflow-hidden group hover:border-zinc-700/60 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all duration-300" />
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shadow-lg">
                  <Trophy className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                  {completedGoalsCount} de {totalGoalsCount}
                </span>
              </div>
              <p className="text-2xl font-black text-white font-mono tracking-tight">{goalsCompletionRate.toFixed(0)}%</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Cumplimiento de Metas</p>
              <div className="w-full bg-zinc-950/60 rounded-full h-1.5 mt-3 border border-white/5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${goalsCompletionRate}%` }} 
                />
              </div>
            </div>

            {/* KPI 2: Finance Balance */}
            <div className="glass-card p-5 relative overflow-hidden group hover:border-zinc-700/60 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all duration-300" />
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shadow-lg">
                  <Wallet className="w-5 h-5" />
                </div>
                {!isHistorical && (
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-wider flex items-center gap-1 px-2 py-0.5 rounded-full border bg-black/40",
                    balanceTrendIsUp ? "text-emerald-400 border-emerald-500/10" : "text-rose-400 border-rose-500/10"
                  )}>
                    {balanceTrendIsUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    VS MES ANT.
                  </span>
                )}
              </div>
              <p className={cn(
                "text-2xl font-black font-mono tracking-tight",
                monthlyBalanceValue >= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {formatCurrency(monthlyBalanceValue)}
              </p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                Balance Financiero {isHistorical ? "Total" : "Mensual"}
              </p>
              <div className="flex items-center gap-3 justify-between mt-3.5 text-[9px] font-black text-zinc-400 border-t border-white/[0.03] pt-2">
                <span>TASA AHORRO: <span className="text-amber-400 font-mono">{savingsRate.toFixed(0)}%</span></span>
                <span>PROM. DIARIO: <span className="text-zinc-200 font-mono">{formatCurrency(averageDailySpend)}</span></span>
              </div>
            </div>

            {/* KPI 3: Active Debts */}
            <div className="glass-card p-5 relative overflow-hidden group hover:border-zinc-700/60 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-all duration-300" />
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shadow-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 px-2 py-0.5 rounded-full bg-rose-500/5 border border-rose-500/10">
                  {debts.filter(d => d.status === "ACTIVE").length} Cuentas
                </span>
              </div>
              <p className="text-2xl font-black text-white font-mono tracking-tight">{formatCurrency(totalActiveDebt)}</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Deuda Activa Total</p>
              <div className="flex justify-between mt-3.5 text-[8.5px] font-bold text-zinc-500 font-mono border-t border-white/[0.03] pt-2">
                <span>PAGO MÍNIMO: <span className="text-rose-400 font-bold">{formatCurrency(totalMinPayment)}</span></span>
                <span className="text-zinc-400">APALANCAMIENTO: <span className="text-amber-400 font-black">{totalIncomeValue > 0 ? ((totalActiveDebt / totalIncomeValue) * 100).toFixed(0) : 0}%</span></span>
              </div>
            </div>

            {/* KPI 4: Time Block Efficiency */}
            <div className="glass-card p-5 relative overflow-hidden group hover:border-zinc-700/60 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-xl group-hover:bg-violet-500/10 transition-all duration-300" />
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center justify-center shadow-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-violet-400 px-2 py-0.5 rounded-full bg-violet-500/5 border border-violet-500/10">
                  {completedTimeBlocksCount} de {plannedTimeBlocksCount} slots
                </span>
              </div>
              <p className="text-2xl font-black text-white font-mono tracking-tight">{timeBlockEfficiency.toFixed(0)}%</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Eficiencia de Agenda</p>
              <div className="w-full bg-zinc-950/60 rounded-full h-1.5 mt-3 border border-white/5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-violet-500 to-violet-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${timeBlockEfficiency}%` }} 
                />
              </div>
              <div className="flex justify-between mt-2.5 text-[8.5px] font-bold text-zinc-500 font-mono">
                <span>PLANIFICADAS: {totalHoursPlanned.toFixed(1)} hrs</span>
                <span className="text-zinc-400">EJECUTADAS: {totalHoursExecuted.toFixed(1)} hrs</span>
              </div>
            </div>

          </div>

          {/* ── CHARTS ROW 1: TRENDS & CATEGORY BREAKDOWN ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart A: Expense Distribution (Pie Chart) */}
            <div className="glass-card-static p-6 lg:col-span-1 flex flex-col justify-between border-zinc-800/80">
              <div>
                <h2 className="text-xs uppercase font-extrabold tracking-widest text-zinc-400 mb-5 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-500" /> Categorías de Gasto
                </h2>
                {expenseCategoryData.length > 0 ? (
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-full relative h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={expenseCategoryData} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            innerRadius={50} 
                            outerRadius={75} 
                            strokeWidth={0}
                            paddingAngle={3}
                          >
                            {expenseCategoryData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} fillOpacity={0.8} className="outline-none hover:fill-opacity-100 transition-all duration-300" />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Total</span>
                        <span className="text-base font-black text-zinc-200 mt-1 font-mono tracking-tight">{formatCurrency(totalExpenseValue)}</span>
                      </div>
                    </div>

                    <div className="w-full space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                      {expenseCategoryData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-white/[0.02]">
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.05)]" style={{ backgroundColor: d.color }} />
                            <span className="text-zinc-400 font-bold truncate">{d.name}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-zinc-200 font-black">{formatCurrency(d.value)}</span>
                            <span className="text-zinc-500 text-[9px] font-bold">({((d.value / totalExpenseValue) * 100).toFixed(0)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[300px] flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full border border-dashed border-zinc-800 flex items-center justify-center mb-3">
                      <Wallet className="w-5 h-5 text-zinc-700" />
                    </div>
                    <p className="text-[11px] text-zinc-500 max-w-[200px]">No se registraron gastos en el período seleccionado</p>
                  </div>
                )}
              </div>
            </div>

            {/* Chart B: Annual Financial Trend (Area Chart) */}
            <div className="glass-card-static p-6 lg:col-span-2 border-zinc-800/80">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xs uppercase font-extrabold tracking-widest text-zinc-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Tendencia Financiera {selectedYear}
                </h2>
                <div className="flex gap-4 text-[9px] font-black uppercase text-zinc-500 select-none">
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Ingresos</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /> Gastos</span>
                </div>
              </div>

              <div className="h-[300px] w-full mt-4 pr-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 5, left: -22, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis 
                      stroke="rgba(255,255,255,0.2)" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} 
                    />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* Glowing Area plots */}
                    <Area type="monotone" dataKey="income" name="Ingresos" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2}/>
                    <Area type="monotone" dataKey="expense" name="Gastos" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={2}/>

                    {/* Highlight selected month vertical reference line */}
                    {!isHistorical && (
                      <ReferenceLine 
                        x={activeMonthNameShort} 
                        stroke="#f59e0b" 
                        strokeDasharray="4 4" 
                        strokeWidth={1.5}
                        label={{ 
                          value: "Mes Seleccionado", 
                          fill: "#f59e0b", 
                          fontSize: 8, 
                          fontWeight: "black", 
                          position: "top", 
                          offset: 10,
                          className: "tracking-widest uppercase"
                        }} 
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* ── CHARTS ROW 2: PRODUCTIVITY & SELF EVALUATIONS ───────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* PRODUCTIVITY HOUR ALLOCATION CHART (Planned vs Real hours) */}
            <div className="glass-card-static p-6 border-zinc-800/80">
              <h2 className="text-xs uppercase font-extrabold tracking-widest text-zinc-400 mb-5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" /> Distribución de Productividad (Horas)
              </h2>
              {productivityData.length > 0 ? (
                <div className="space-y-5">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider leading-relaxed">
                    Comparativa del tiempo dedicado a cada aspecto de tu agenda. Compara tus horas planificadas contra tus horas ejecutadas reales.
                  </p>
                  <div className="space-y-4">
                    {productivityData.map((d, index) => {
                      const efficiency = d.planificadas > 0 ? (d.reales / d.planificadas) * 100 : 0;
                      return (
                        <div key={index} className="space-y-2 border-b border-white/[0.02] pb-3 last:border-b-0 last:pb-0">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-extrabold text-zinc-300">{d.category}</span>
                            <div className="flex items-center gap-3 font-mono text-[10px]">
                              <span className="text-zinc-500">Plan: <strong className="text-zinc-300 font-bold">{d.planificadas.toFixed(1)}h</strong></span>
                              <span className="text-zinc-500">Real: <strong className="text-amber-400 font-bold">{d.reales.toFixed(1)}h</strong></span>
                              <span className="text-emerald-400 font-black">({efficiency.toFixed(0)}%)</span>
                            </div>
                          </div>
                          
                          {/* Visual progress bar representing Plan vs Real */}
                          <div className="w-full h-3 bg-zinc-950 border border-white/5 rounded-lg overflow-hidden relative shadow-inner">
                            {/* Planned Bar (Backyard background) */}
                            <div 
                              className="absolute top-0 left-0 bottom-0 bg-zinc-800 border-r border-zinc-700 transition-all duration-500" 
                              style={{ width: `${Math.min(100, (d.planificadas / totalHoursPlanned) * 100)}%` }}
                              title="Horas Planificadas"
                            />
                            {/* Executed Bar (Active indicator) */}
                            <div 
                              className="absolute top-0.5 left-0.5 bottom-0.5 bg-gradient-to-r from-amber-600 to-amber-500 rounded-md shadow-[0_0_8px_rgba(245,158,11,0.2)] transition-all duration-500" 
                              style={{ width: `calc(${Math.min(100, (d.reales / totalHoursPlanned) * 100)}% - 4px)` }}
                              title="Horas Reales Ejecutadas"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-[250px] flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full border border-dashed border-zinc-800 flex items-center justify-center mb-3">
                    <Clock className="w-5 h-5 text-zinc-700" />
                  </div>
                  <p className="text-[11px] text-zinc-500 max-w-[200px]">Planifica bloques en tu Agenda y ejecuta tareas para ver la distribución de tiempo aquí</p>
                </div>
              )}
            </div>

            {/* HOMOLOGATED ACTIVITIES RANKING CARD */}
            <div className="glass-card-static p-6 border-zinc-800/80">
              <h2 className="text-xs uppercase font-extrabold tracking-widest text-zinc-400 mb-5 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> Top Actividades Homologadas
              </h2>
              {homologatedActivitiesData.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider leading-relaxed mb-3">
                    Consolidación automática de actividades por alias homologados (ej. Descanso, Daskalos/Red, Running, Aprendizaje).
                  </p>
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                    {homologatedActivitiesData.map((act, idx) => {
                      const totalPlan = totalHoursPlanned || 1;
                      const pct = Math.min(100, (act.planificadas / totalPlan) * 100);
                      return (
                        <div key={idx} className="p-2.5 bg-zinc-950/60 border border-zinc-900/80 rounded-xl space-y-1.5 hover:border-zinc-800 transition-colors">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 font-bold truncate">
                              <span className="w-4 text-[10px] text-zinc-500 font-mono">#{idx + 1}</span>
                              <span className="text-zinc-200 truncate">{act.name}</span>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
                              <span className="text-amber-400 font-black">{act.planificadas.toFixed(1)}h</span>
                              <span className="text-zinc-500">({pct.toFixed(1)}%)</span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full" 
                              style={{ width: `${pct}%` }} 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-[180px] flex flex-col items-center justify-center text-center">
                  <p className="text-[11px] text-zinc-500">No hay datos de actividades en este periodo</p>
                </div>
              )}
            </div>

            {/* SELF EVALUATION RATINGS (Reviews Balance of Life) */}
            <div className="glass-card-static p-6 border-zinc-800/80">
              <h2 className="text-xs uppercase font-extrabold tracking-widest text-zinc-400 mb-5 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" /> Balance de Vida (Autoevaluación)
              </h2>
              {selfEvalScores.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider leading-relaxed">
                    Tus promedios mensuales en las 7 dimensiones vitales del Yo, consolidados de tus revisiones de este ciclo.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1.5">
                    {selfEvalScores.map((dim, idx) => {
                      const colorMap: Record<string, string> = {
                        yoFisico: "from-emerald-500/10 to-emerald-600/5 text-emerald-400 border-emerald-500/20",
                        yoProfesional: "from-blue-500/10 to-blue-600/5 text-blue-400 border-blue-500/20",
                        yoEmprendedor: "from-violet-500/10 to-violet-600/5 text-violet-400 border-violet-500/20",
                        yoMental: "from-pink-500/10 to-pink-600/5 text-pink-400 border-pink-500/20",
                        yoRelacional: "from-indigo-500/10 to-indigo-600/5 text-indigo-400 border-indigo-500/20",
                        yoEspiritual: "from-teal-500/10 to-teal-600/5 text-teal-400 border-teal-500/20",
                        yoProposito: "from-amber-500/10 to-amber-600/5 text-amber-400 border-amber-500/20",
                      };
                      const bgClass = colorMap[dim.key] || "from-zinc-500/10 to-zinc-600/5 text-zinc-400 border-zinc-500/20";
                      const pct = (dim.avgRating / 5) * 100;
                      return (
                        <div key={idx} className="bg-zinc-950/40 border border-zinc-900/60 rounded-xl p-3.5 flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-zinc-300 flex items-center gap-1.5">
                              <span>{dim.icon}</span> {dim.label}
                            </span>
                            <span className="text-xs font-black text-amber-400 font-mono bg-amber-500/5 px-2 py-0.5 border border-amber-500/10 rounded-lg">
                              {dim.avgRating.toFixed(1)} / 5
                            </span>
                          </div>
                          <div className="progress-bar bg-zinc-950 mt-1">
                            <div 
                              className={cn(
                                "progress-bar-fill shadow-[0_0_10px_rgba(245,158,11,0.1)] bg-gradient-to-r",
                                dim.key === "yoFisico" && "from-emerald-600 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]",
                                dim.key === "yoProfesional" && "from-blue-600 to-blue-400 shadow-[0_0_8px_rgba(14,165,233,0.2)]",
                                dim.key === "yoEmprendedor" && "from-violet-600 to-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.2)]",
                                dim.key === "yoMental" && "from-pink-600 to-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.2)]",
                                dim.key === "yoRelacional" && "from-indigo-600 to-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.2)]",
                                dim.key === "yoEspiritual" && "from-teal-600 to-teal-400 shadow-[0_0_8px_rgba(20,184,166,0.2)]",
                                dim.key === "yoProposito" && "from-amber-600 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                              )} 
                              style={{ width: `${pct}%` }} 
                            />
                          </div>
                          <span className="text-[8.5px] font-bold text-zinc-500 uppercase tracking-widest mt-2 block font-mono text-right">
                            {dim.reviewCount} {dim.reviewCount === 1 ? "revisión" : "revisiones"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-[250px] flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full border border-dashed border-zinc-800 flex items-center justify-center mb-3">
                    <Sparkles className="w-5 h-5 text-zinc-700" />
                  </div>
                  <p className="text-[11px] text-zinc-500 max-w-[200px] mb-4">
                    Registra revisiones en la sección de Revisiones para ver tu balance de vida de este mes
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* ── DETAIL COMPARISON BLOCK: FIXED VS VARIABLE FINANCES ───────────────────── */}
          <div className="glass-card-static p-6 border-zinc-800/80">
            <div className="flex justify-between items-center mb-5 border-b border-white/5 pb-3">
              <h2 className="text-xs uppercase font-extrabold tracking-widest text-zinc-400 flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400" /> Plan vs Realidad — Resumen Financiero
              </h2>
              <span className="text-[9px] font-black uppercase text-zinc-500 bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg font-mono">
                {isHistorical ? "Acumulado Histórico" : `Detalle de ${MONTH_NAMES[selectedMonth - 1]}`}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div className="p-4 rounded-xl bg-zinc-950/40 border border-white/[0.02]">
                <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Ingresos Consolidados</span>
                <p className="text-xl font-black font-mono text-emerald-400 mt-1">{formatCurrency(totalIncomeValue)}</p>
                <div className="progress-bar bg-zinc-900 mt-3 h-1"><div className="progress-bar-fill bg-emerald-500" style={{ width: "100%" }} /></div>
                <span className="text-[8px] text-zinc-600 mt-2 block font-mono">100% de capital neto de entrada</span>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/40 border border-white/[0.02]">
                <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Gastos Consolidados</span>
                <p className="text-xl font-black font-mono text-rose-400 mt-1">{formatCurrency(totalExpenseValue)}</p>
                <div className="progress-bar bg-zinc-900 mt-3 h-1">
                  <div 
                    className="progress-bar-fill bg-rose-500" 
                    style={{ width: `${Math.min(100, totalIncomeValue > 0 ? (totalExpenseValue / totalIncomeValue) * 100 : 0)}%` }} 
                  />
                </div>
                <span className="text-[8px] text-zinc-600 mt-2 block font-mono">
                  {totalIncomeValue > 0 ? ((totalExpenseValue / totalIncomeValue) * 100).toFixed(0) : 0}% de los ingresos totales
                </span>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/40 border border-white/[0.02]">
                <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Gastos Fijos Programados</span>
                <p className="text-xl font-black font-mono text-zinc-200 mt-1">
                  {formatCurrency(filteredExpenses.filter(e => e.type === "FIJO" || e.type === "SUSCRIPCION").reduce((s, e) => s + e.amount, 0))}
                </p>
                <div className="progress-bar bg-zinc-900 mt-3 h-1">
                  <div 
                    className="progress-bar-fill bg-zinc-400" 
                    style={{ width: `${Math.min(100, totalExpenseValue > 0 ? (filteredExpenses.filter(e => e.type === "FIJO" || e.type === "SUSCRIPCION").reduce((s, e) => s + e.amount, 0) / totalExpenseValue) * 100 : 0)}%` }} 
                  />
                </div>
                <span className="text-[8px] text-zinc-600 mt-2 block font-mono">
                  Gastos constantes obligatorios
                </span>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/40 border border-white/[0.02]">
                <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Gastos Variables / Impulsivos</span>
                <p className="text-xl font-black font-mono text-amber-500 mt-1">
                  {formatCurrency(filteredExpenses.filter(e => e.type === "VARIABLE").reduce((s, e) => s + e.amount, 0))}
                </p>
                <div className="progress-bar bg-zinc-900 mt-3 h-1">
                  <div 
                    className="progress-bar-fill bg-amber-500" 
                    style={{ width: `${Math.min(100, totalExpenseValue > 0 ? (filteredExpenses.filter(e => e.type === "VARIABLE").reduce((s, e) => s + e.amount, 0) / totalExpenseValue) * 100 : 0)}%` }} 
                  />
                </div>
                <span className="text-[8px] text-zinc-600 mt-2 block font-mono">
                  Gastos variables discrecionales
                </span>
              </div>

            </div>

            {/* Sección de Deuda y Apalancamiento Financiero */}
            {totalActiveDebt > 0 && (
              <div className="mt-6 pt-6 border-t border-white/[0.04]">
                <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-4 flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-rose-400" /> Diagnóstico de Apalancamiento y Cuentas de Deuda
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-rose-500/[0.02] border border-rose-500/10 flex justify-between items-center">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-rose-400 tracking-wider">Deuda Consolidada Activa</span>
                      <p className="text-xl font-black font-mono text-rose-400 mt-1">{formatCurrency(totalActiveDebt)}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase text-rose-500 bg-rose-500/5 px-2.5 py-1 border border-rose-500/10 rounded-lg font-mono">
                      {debts.filter(d => d.status === "ACTIVE").length} Cuentas
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-orange-500/[0.02] border border-orange-500/10 flex justify-between items-center">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-orange-400 tracking-wider">Pago Mínimo Comprometido</span>
                      <p className="text-xl font-black font-mono text-orange-400 mt-1">{formatCurrency(totalMinPayment)}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase text-orange-500 bg-orange-500/5 px-2.5 py-1 border border-orange-500/10 rounded-lg font-mono animate-pulse">
                      Mes en Curso
                    </span>
                  </div>
                </div>

                {/* List of active debts breakdown */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {debts.filter(d => d.status === "ACTIVE").map((d, i) => {
                    const debtPct = totalActiveDebt > 0 ? (d.currentBalance / totalActiveDebt) * 100 : 0;
                    return (
                      <div key={i} className="p-3.5 bg-zinc-950/40 border border-white/[0.03] rounded-xl flex flex-col justify-between hover:border-rose-500/10 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-2 select-none">
                          <span className="text-[10px] font-black text-zinc-300 truncate">{d.entity}</span>
                          <span className="text-[8px] text-zinc-500 font-extrabold uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded">{d.type}</span>
                        </div>
                        <div>
                          <p className="text-sm font-black text-zinc-100 font-mono tracking-tight">{formatCurrency(d.currentBalance)}</p>
                          <div className="progress-bar bg-zinc-900 mt-2 h-1">
                            <div className="progress-bar-fill bg-rose-500" style={{ width: `${debtPct}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[8px] text-zinc-500 mt-2.5 font-mono uppercase tracking-wider">
                          <span>Mín: {formatCurrency(d.minimumPayment)}</span>
                          <span className="text-rose-400 font-black">{debtPct.toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="glass-card-accent p-12 text-center border-zinc-800/60">
          <div className="w-16 h-16 rounded-3xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-center mx-auto mb-4 shadow-xl">
            <BarChart3 className="w-6 h-6 text-zinc-600" />
          </div>
          <h3 className="text-base font-black text-zinc-200 mb-1">Sin datos analíticos</h3>
          <p className="text-xs text-zinc-500 max-w-[280px] mx-auto leading-relaxed">
            Aún no has registrado suficiente información. Agrega metas, misiones, registros en tu agenda o finanzas para activar tu analítica.
          </p>
        </div>
      )}
    </div>
  );
}
