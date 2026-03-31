"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { getAll, getAllFinance } from "@/lib/repositories/firestore";
import { Goal, Mission, TimeBlock, Income, Expense } from "@/lib/types";
import { BarChart3, Target, Clock, Wallet, Trophy, Zap } from "lucide-react";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, LineChart, Line, CartesianGrid, Legend, AreaChart, Area
} from "recharts";

function parseTimeToHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh + em / 60) - (sh + sm / 60);
}

const CHART_COLORS = ["#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#f97316", "#14b8a6", "#ef4444"];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-zinc-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-zinc-100 font-medium">{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</p>
      ))}
    </div>
  );
};

export default function AnaliticaPage() {
  const { user } = useAuth();
  const uid = useUid();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!uid) return;
    const [g, m, tb, inc, exp] = await Promise.all([
      getAll<Goal>(uid, "goals"),
      getAll<Mission>(uid, "missions"),
      getAll<TimeBlock>(uid, "timeBlocks"),
      getAllFinance<Income>(uid, "income"),
      getAllFinance<Expense>(uid, "expenses"),
    ]);
    setGoals(g); setMissions(m);
    setTimeBlocks(tb); setIncomes(inc); setExpenses(exp); setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // KPIs
  const totalGoals = goals.length;
  const completedGoals = goals.filter(g => g.status === "COMPLETED").length;

  const totalMissions = missions.length;
  const completedMissions = missions.filter(m => m.status === "COMPLETED").length;
  const totalTimeHours = timeBlocks.reduce((sum, tb) => sum + parseTimeToHours(tb.startTime, tb.endTime), 0);
  const completedTimeHours = timeBlocks.filter(tb => tb.executedStatus === "COMPLETED").reduce((sum, tb) => sum + parseTimeToHours(tb.startTime, tb.endTime), 0);
  const totalIncome = incomes.reduce((sum, i) => sum + i.netIncome, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);



  // Expense category pie data
  const expenseCategoryData = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {})
  ).map(([name, value], idx) => ({ name, value, color: CHART_COLORS[idx % CHART_COLORS.length] }));

  // Radial progress data
  const radialData = [
    { name: "Metas", value: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0, fill: "#22c55e" },

    { name: "Misiones", value: totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0, fill: "#a855f7" },
  ].filter(d => d.value > 0 || d.name === "Metas");

  // Trend Data (Income vs Expense over time by Month)
  const currentYear = new Date().getFullYear();
  const monthlyDataMap: Record<number, { name: string; income: number; expense: number }> = {};
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  for (let i = 0; i < 12; i++) {
     monthlyDataMap[i] = { name: monthNames[i], income: 0, expense: 0 };
  }
  
  incomes.forEach(inc => {
      const parts = inc.month?.split("-") || [];
      if(parts.length >= 2 && Number(parts[0]) === currentYear) {
          monthlyDataMap[Number(parts[1]) - 1].income += inc.netIncome;
      }
  });

  expenses.forEach(exp => {
      const parts = exp.month?.split("-") || [];
      if(parts.length >= 2 && Number(parts[0]) === currentYear) {
          monthlyDataMap[Number(parts[1]) - 1].expense += exp.amount;
      }
  });

  const trendData = Object.values(monthlyDataMap);

  if (loading) return (
    <div className="page-enter space-y-6">
      <div className="h-10 w-48 skeleton" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-32 skeleton" />)}</div>
    </div>
  );

  const hasData = goals.length > 0;

  return (
    <div className="page-enter space-y-6">
      

      <div>
        <h1 className="text-xl font-bold flex items-center gap-2.5 tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/15 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-amber-400" />
          </div>
          Analítica
        </h1>
        <p className="text-[12px] text-zinc-500 mt-1 ml-[42px]">Visión integral de tu progreso</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[
          { icon: Trophy, label: "Metas completadas", val: `${completedGoals}/${totalGoals}`, pct: totalGoals > 0 ? completedGoals / totalGoals * 100 : 0, color: "emerald" },
          { icon: Wallet, label: "Balance", val: formatCurrency(totalIncome - totalExpense), pct: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0, color: (totalIncome - totalExpense) >= 0 ? "emerald" : "red" },
        ].map((kpi, idx) => {
          const colorMap: Record<string, string> = {
            emerald: "from-emerald-500/12 to-emerald-600/5 text-emerald-400",
            blue: "from-blue-500/12 to-blue-600/5 text-blue-400",
            amber: "from-amber-500/12 to-amber-600/5 text-amber-400",
            red: "from-red-500/12 to-red-600/5 text-red-400",
          };
          const c = colorMap[kpi.color] || colorMap.amber;
          return (
            <div key={idx} className="glass-card p-4 overflow-hidden">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${c.split(" ").slice(0, 2).join(" ")} border border-white/[0.04] flex items-center justify-center mb-3`}>
                <kpi.icon className={`w-4 h-4 ${c.split(" ").pop()}`} />
              </div>
              <p className="text-lg font-bold stat-number">{kpi.val}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{kpi.label}</p>
              <div className="progress-bar mt-2"><div className="progress-bar-fill" style={{ width: `${Math.max(kpi.pct, 0)}%` }} /></div>
            </div>
          );
        })}
      </div>

      {hasData ? (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Expense distribution */}
              <div className="glass-card-static p-5 lg:col-span-1">
                <h2 className="text-[13px] font-semibold mb-4 flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 text-amber-400" /> Distribución
                </h2>
                {expenseCategoryData.length > 0 ? (
                  <div className="flex flex-col items-center gap-4">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={expenseCategoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} strokeWidth={0}>
                          {expenseCategoryData.map((entry, i) => <Cell key={i} fill={entry.color} fillOpacity={0.8} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="w-full space-y-2 max-h-[120px] overflow-y-auto custom-scrollbar pr-2">
                      {expenseCategoryData.map((d, i) => (
                        <div key={i} className="flex items-center gap-3 text-[10px]">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="text-zinc-400 flex-1 truncate">{d.name}</span>
                          <span className="text-zinc-300 font-medium">{formatCurrency(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[220px] flex items-center justify-center">
                    <p className="text-[11px] text-zinc-600">Agrega gastos para ver la distribución</p>
                  </div>
                )}
              </div>

              {/* Trend Chart */}
              <div className="glass-card-static p-5 lg:col-span-2">
                <h2 className="text-[13px] font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-400" /> Tendencia {currentYear}
                </h2>
                <div className="h-[250px] w-full mt-4">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="income" name="Ingresos" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2}/>
                          <Area type="monotone" dataKey="expense" name="Gastos" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={2}/>
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
              </div>
            </div>

          {/* Completion rates */}
          <div className="glass-card-static p-5">
            <h2 className="text-[13px] font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Tasa de cumplimiento
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {radialData.map((d, i) => (
                <div key={i} className="text-center">
                  <ResponsiveContainer width="100%" height={100}>
                    <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" barSize={8} data={[d]} startAngle={90} endAngle={-270}>
                      <RadialBar background={{ fill: "rgba(39, 39, 42, 0.3)" }} dataKey="value" cornerRadius={10} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <p className="text-lg font-bold mt-1" style={{ color: d.fill }}>{d.value}%</p>
                  <p className="text-[10px] text-zinc-500">{d.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Plan vs Reality */}
          <div className="grid grid-cols-1 gap-4">

            <div className="glass-card-static p-5">
              <h2 className="text-[13px] font-semibold mb-4">Plan vs Realidad — Finanzas</h2>
              <div className="space-y-3">
                {[
                  { l: "Ingresos totales", v: formatCurrency(totalIncome), c: "text-emerald-400" },
                  { l: "Gastos totales", v: formatCurrency(totalExpense), c: "text-red-400" },
                  { l: "Gastos fijos", v: formatCurrency(expenses.filter(e => e.type === "FIJO").reduce((s, e) => s + e.amount, 0)), c: "text-zinc-200" },
                  { l: "Gastos variables", v: formatCurrency(expenses.filter(e => e.type === "VARIABLE").reduce((s, e) => s + e.amount, 0)), c: "text-zinc-200" },
                  { l: "Tasa de ahorro", v: `${totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0}%`, c: "text-amber-400" },
                ].map((m, i) => (
                  <div key={i} className="flex justify-between text-xs"><span className="text-zinc-500">{m.l}</span><span className={`font-medium ${m.c}`}>{m.v}</span></div>
                ))}
              </div>
            </div>
          </div>

          {/* Missions overview */}
          <div className="glass-card-static p-5">
            <h2 className="text-[13px] font-semibold mb-4">Misiones</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              {[
                { v: totalMissions, l: "Total", c: "text-zinc-200" },
                { v: completedMissions, l: "Completadas", c: "text-emerald-400" },
                { v: missions.filter(m => m.status === "IN_PROGRESS").length, l: "En progreso", c: "text-blue-400" },
                { v: missions.filter(m => m.status === "FAILED").length, l: "Fallidas", c: "text-red-400" },
              ].map((m, i) => (
                <div key={i}><p className={`text-2xl font-bold stat-number ${m.c}`}>{m.v}</p><p className="text-[10px] text-zinc-500 mt-1">{m.l}</p></div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="glass-card-accent p-8 text-center empty-state">
          <div className="empty-state-icon mx-auto">
            <BarChart3 className="w-6 h-6 text-zinc-600" />
          </div>
          <h3 className="text-sm font-medium text-zinc-300 mb-1">Sin datos para analizar</h3>
          <p className="text-[11px] text-zinc-500">Empieza creando metas para ver tus analíticas</p>
        </div>
      )}
    </div>
  );
}
