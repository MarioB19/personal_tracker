"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { PiggyBank, Plus, Save, Trash2, CalendarDays, TrendingUp, TrendingDown, GripHorizontal, Coins, CheckCircle2, AlertCircle, ArrowUpRight, BarChart3, RotateCcw } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { SavingsPlanYear, IncomeSourcePlan, PlanMilestone } from "@/lib/types";
import { collection, query, where, getDocs, setDoc, doc, Timestamp, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const YEARS = [2026, 2027, 2028, 2029, 2030];

export default function PlanificadorPage() {
  const { user } = useAuth();
  const uid = useUid();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeYear, setActiveYear] = useState<number>(2026);
  const [planId, setPlanId] = useState<string>("");
  
  // Data state
  const [initialSavings, setInitialSavings] = useState<number>(0);
  const [incomes, setIncomes] = useState<IncomeSourcePlan[]>([]);
  const [expenses, setExpenses] = useState<number[]>(Array(12).fill(0));
  const [actualSavings, setActualSavings] = useState<number[]>(Array(12).fill(0));
  const [milestones, setMilestones] = useState<PlanMilestone[]>([]);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const loadPlan = useCallback(async (yearToLoad: number) => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = query(collection(db, "savings_plans"), where("userId", "==", uid), where("year", "==", yearToLoad));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data() as SavingsPlanYear;
        setPlanId(docSnap.id);
        setInitialSavings(data.initialSavings || 0);
        setIncomes(data.incomeSources || []);
        
        // Handle migration if expenses is not 12 elements
        let exp = data.expensesValues || Array(12).fill(0);
        if (exp.length < 12) exp = [...exp, ...Array(12 - exp.length).fill(0)];
        setExpenses(exp);

        let act = data.actualSavingsValues || Array(12).fill(0);
        if (act.length < 12) act = [...act, ...Array(12 - act.length).fill(0)];
        setActualSavings(act);
        
        setMilestones(data.milestones || []);
      } else {
        // Init empty
        setPlanId("");
        setInitialSavings(0);
        setIncomes([
          { id: crypto.randomUUID(), name: "Ingreso base", values: Array(12).fill(0) }
        ]);
        setExpenses(Array(12).fill(0));
        setActualSavings(Array(12).fill(0));
        setMilestones([]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    loadPlan(activeYear);
  }, [activeYear, loadPlan]);

  const handleSave = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      const idToSave = planId || crypto.randomUUID();
      const basePayload: Omit<SavingsPlanYear, "id" | "createdAt" | "updatedAt"> = {
        userId: uid,
        year: activeYear,
        initialSavings,
        incomeSources: incomes,
        expensesValues: expenses,
        actualSavingsValues: actualSavings,
        milestones,
      };

      if (!planId) {
          // Create new document
          await setDoc(doc(db, "savings_plans", idToSave), {
              ...basePayload,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
          });
          setPlanId(idToSave);
      } else {
          // Update existing
          await setDoc(doc(db, "savings_plans", idToSave), {
              ...basePayload,
              updatedAt: Timestamp.now()
          }, { merge: true });
      }
      

      
    } catch (e) {
      console.error(e);
      alert("Error al guardar");
    }
    setSaving(false);
  };



  // Calculations
  const calcTotalIncome = (monthIdx: number) => {
    return incomes.reduce((acc, inc) => acc + (inc.values[monthIdx] || 0), 0);
  };

  const calcNetSavingsMonth = (monthIdx: number) => {
    return calcTotalIncome(monthIdx) - (expenses[monthIdx] || 0);
  };

  const calcAccumulated = (monthIdx: number) => {
    let acc = initialSavings;
    for (let i = 0; i <= monthIdx; i++) {
        acc += calcNetSavingsMonth(i);
    }
    return acc;
  };

  const updateIncomeValue = (sourceId: string, monthIdx: number, val: string) => {
    const num = Number(val) || 0;
    setIncomes((prev) => 
      prev.map(i => {
        if (i.id === sourceId) {
          const newVals = [...i.values];
          newVals[monthIdx] = num;
          return { ...i, values: newVals };
        }
        return i;
      })
    );
  };

  const updateExpenseValue = (monthIdx: number, val: string) => {
    const num = Number(val) || 0;
    setExpenses(prev => {
      const newVals = [...prev];
      newVals[monthIdx] = num;
      return newVals;
    });
  };
  
  const addIncomeSource = () => {
    setIncomes([...incomes, { id: crypto.randomUUID(), name: "Nuevo ingreso", values: Array(12).fill(0) }]);
  };
  
  const removeIncomeSource = (id: string) => {
    setIncomes(incomes.filter(i => i.id !== id));
  };

  const fillIncomeYear = (sourceId: string) => {
    setIncomes((prev) => 
      prev.map(i => {
        if (i.id === sourceId) {
          const firstVal = i.values[0] || 0;
          return { ...i, values: Array(12).fill(firstVal) };
        }
        return i;
      })
    );
  };

  const fillExpenseYear = () => {
    const firstVal = expenses[0] || 0;
    setExpenses(Array(12).fill(firstVal));
  };

  const addMilestone = () => {
    setMilestones([...milestones, { id: crypto.randomUUID(), name: "Nuevo hito", amount: 0, startMonth: 0, endMonth: 0 }]);
  };

  const updateMilestone = (id: string, updates: Partial<PlanMilestone>) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };
  const removeMilestone = (id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
  };

  const renderChart = () => {
    // Generate data points for 12 months
    const dataPoints = MONTHS.map((_, i) => calcAccumulated(i));
    const maxVal = Math.max(...dataPoints, 100);
    const minVal = Math.min(...dataPoints, 0);
    const range = maxVal - minVal || 1;
    
    // SVG Dimensions
    const width = 600;
    const height = 120;
    const padding = 20;
    
    // Map values to coordinates
    const coords = dataPoints.map((val, idx) => {
      const x = padding + (idx * (width - 2 * padding)) / 11;
      const y = height - padding - ((val - minVal) * (height - 2 * padding)) / range;
      return { x, y };
    });
    
    // Generate path d-string
    if (coords.length === 0) return null;
    
    const linePath = coords.reduce((acc, coord, idx) => {
      return acc + `${idx === 0 ? "M" : "L"} ${coord.x} ${coord.y}`;
    }, "");
    
    const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`;
    
    const formatShortCurrency = (val: number) => {
      const absVal = Math.abs(val);
      if (absVal >= 1000000) {
        return (val / 1000000).toFixed(1).replace(".0", "") + "M";
      }
      if (absVal >= 1000) {
        return (val / 1000).toFixed(1).replace(".0", "") + "k";
      }
      return val.toString();
    };
    
    return (
      <div className="bg-[#0c0c0e]/50 backdrop-blur-xl border border-white/[0.05] rounded-2xl p-5 shadow-2xl space-y-4 mb-6 hover:border-white/[0.08] transition-all duration-300 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-black text-zinc-300 uppercase tracking-widest">Curva de Crecimiento de Ahorro Acumulado</h3>
          </div>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Proyección Anual ({activeYear})</span>
        </div>
        
        <div className="relative w-full h-[120px] select-none">
          {/* Dashboard Tooltip Flotante */}
          {hoveredMonth !== null && (
            <div 
              className="absolute bg-zinc-950/95 backdrop-blur-md border border-amber-500/30 rounded-xl px-3 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-30 flex flex-col items-center gap-0.5 pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95"
              style={{
                left: `${(coords[hoveredMonth].x / width) * 100}%`,
                top: `${(coords[hoveredMonth].y / height) * 100 - 15}%`,
                transform: "translate(-50%, -100%)"
              }}
            >
              <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest font-mono">{MONTHS[hoveredMonth]} {activeYear}</span>
              <span className="text-xs font-black text-amber-400 font-mono">{formatCurrency(dataPoints[hoveredMonth])}</span>
              <span className={cn("text-[8px] font-bold uppercase font-mono", calcNetSavingsMonth(hoveredMonth) >= 0 ? "text-emerald-400" : "text-red-400")}>
                Neto: {calcNetSavingsMonth(hoveredMonth) >= 0 ? "+" : ""}{formatCurrency(calcNetSavingsMonth(hoveredMonth)).split(".")[0]}
              </span>
            </div>
          )}

          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(245, 158, 11)" stopOpacity="0.12" />
                <stop offset="100%" stopColor="rgb(245, 158, 11)" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgb(245, 158, 11)" />
                <stop offset="100%" stopColor="rgb(251, 146, 60)" />
              </linearGradient>
            </defs>
            
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
              const y = padding + p * (height - 2 * padding);
              return (
                <line
                  key={i}
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="rgba(255,255,255,0.02)"
                  strokeWidth="1"
                />
              );
            })}
            
            {/* Hover Vertical dashed indicator line */}
            {hoveredMonth !== null && (
              <line
                x1={coords[hoveredMonth].x}
                y1={padding}
                x2={coords[hoveredMonth].x}
                y2={height - padding}
                stroke="rgba(245,158,11,0.2)"
                strokeDasharray="2,2"
                strokeWidth="1"
              />
            )}

            {/* Area Path */}
            <path d={areaPath} fill="url(#areaGradient)" />
            
            {/* Line Path */}
            <path d={linePath} fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            
            {/* Value labels always visible above nodes */}
            {coords.map((coord, idx) => {
              const isHovered = hoveredMonth === idx;
              return (
                <text
                  key={`val-${idx}`}
                  x={coord.x}
                  y={coord.y - 8}
                  textAnchor="middle"
                  className={cn(
                    "text-[8px] font-mono tracking-tighter select-none font-bold transition-all duration-150",
                    isHovered ? "fill-amber-400 text-[10px] font-black" : "fill-zinc-500"
                  )}
                >
                  ${formatShortCurrency(dataPoints[idx])}
                </text>
              );
            })}

            {/* Coordinates markers */}
            {coords.map((coord, idx) => {
              const isHovered = hoveredMonth === idx;
              return (
                <g 
                  key={idx} 
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredMonth(idx)}
                  onMouseLeave={() => setHoveredMonth(null)}
                >
                  <circle
                    cx={coord.x}
                    cy={coord.y}
                    r={isHovered ? 4.5 : 3}
                    className={cn(
                      "transition-all duration-150",
                      isHovered 
                        ? "fill-amber-500 stroke-[#0a0a0c] stroke-[2]" 
                        : "fill-[#0a0a0c] stroke-amber-500 stroke-[1.5]"
                    )}
                  />
                  <circle
                    cx={coord.x}
                    cy={coord.y}
                    r="12"
                    className="fill-transparent"
                  />
                </g>
              );
            })}
          </svg>
        </div>
        
        {/* X Axis Labels */}
        <div className="flex justify-between px-1 text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono select-none">
          {MONTHS.map((m, idx) => (
            <span key={idx} className="text-center font-extrabold" style={{ width: `${100 / 12}%` }}>
              {m}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="page-enter space-y-8">
        <div className="h-8 w-48 bg-zinc-900 rounded animate-pulse" />
        <div className="h-96 bg-zinc-900 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="page-enter pb-32">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 mt-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                        <PiggyBank className="w-4 h-4 text-green-400" />
                    </div>
                    Planificador de Ahorro
                </h1>
                <p className="text-sm text-zinc-500 mt-1 ml-12">
                    Proyección de flujo de caja y mapa de hitos por año
                </p>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="flex bg-[#0c0c0e] border border-white/10 rounded-xl p-1">
                    {YEARS.map(y => (
                        <button 
                            key={y}
                            onClick={() => setActiveYear(y)}
                            className={cn(
                                "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                activeYear === y ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            {y}
                        </button>
                    ))}
                </div>
                

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary text-sm py-2 px-4 shadow-[0_0_20px_rgba(245,158,11,0.1)] hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] disabled:opacity-50"
                >
                    {saving ? "Guardando..." : <><Save className="w-4 h-4 mr-2" /> Guardar Plan</>}
                </button>
            </div>
        </div>

      {/* Dashboard de Métricas Financieras Premium */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Saldo Inicial */}
        <div className="bg-[#0c0c0e]/50 backdrop-blur-xl border border-white/[0.05] rounded-2xl p-4 shadow-xl transition-all duration-300 hover:border-amber-500/20 hover:-translate-y-0.5 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">Saldo Inicial (Base)</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/20 transition-all">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-amber-500 font-extrabold text-lg">$</span>
            <input 
              type="number"
              value={initialSavings === 0 ? "" : initialSavings}
              onChange={(e) => setInitialSavings(Number(e.target.value) || 0)}
              className="bg-transparent text-xl text-amber-400 font-black outline-none w-full border-b border-transparent focus:border-amber-500/30 transition-colors hide-arrows"
              placeholder="0.00"
            />
          </div>
          <p className="text-[9px] text-zinc-500 mt-2 font-medium">Capital disponible al inicio del año</p>
        </div>

        {/* Card 2: Ahorro Total Proyectado */}
        <div className="bg-[#0c0c0e]/50 backdrop-blur-xl border border-white/[0.05] rounded-2xl p-4 shadow-xl transition-all duration-300 hover:border-emerald-500/20 hover:-translate-y-0.5 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">Total Proyectado ({activeYear})</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-all">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-400 mt-1.5 font-mono">
            {formatCurrency(calcAccumulated(11))}
          </div>
          <p className="text-[9px] text-zinc-500 mt-2 font-medium flex items-center gap-1">
            Crecimiento neto de {formatCurrency(calcAccumulated(11) - initialSavings)}
          </p>
        </div>

        {/* Card 3: Ahorro Mensual Promedio */}
        <div className="bg-[#0c0c0e]/50 backdrop-blur-xl border border-white/[0.05] rounded-2xl p-4 shadow-xl transition-all duration-300 hover:border-blue-500/20 hover:-translate-y-0.5 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">Ahorro Mensual Promedio</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-all">
              <PiggyBank className="w-3.5 h-3.5 text-blue-400" />
            </div>
          </div>
          <div className="text-xl font-black text-blue-400 mt-1.5 font-mono">
            {formatCurrency(MONTHS.reduce((acc, _, i) => acc + calcNetSavingsMonth(i), 0) / 12)}
          </div>
          <p className="text-[9px] text-zinc-500 mt-2 font-medium">Excedente de caja promedio por mes</p>
        </div>

        {/* Card 4: Tasa de Hitos Viables */}
        <div className="bg-[#0c0c0e]/50 backdrop-blur-xl border border-white/[0.05] rounded-2xl p-4 shadow-xl transition-all duration-300 hover:border-fuchsia-500/20 hover:-translate-y-0.5 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">Viabilidad de Hitos</span>
            <div className="w-7 h-7 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center group-hover:bg-fuchsia-500/20 transition-all">
              <CalendarDays className="w-3.5 h-3.5 text-fuchsia-400" />
            </div>
          </div>
          <div className="text-xl font-black text-fuchsia-400 mt-1.5 font-mono">
            {milestones.length === 0 ? "0%" : `${Math.round((milestones.filter(m => calcAccumulated(m.endMonth) >= m.amount).length / milestones.length) * 100)}%`}
          </div>
          <p className="text-[9px] text-zinc-500 mt-2 font-medium">
            {milestones.length === 0 ? "Sin hitos registrados" : `${milestones.filter(m => calcAccumulated(m.endMonth) >= m.amount).length} de ${milestones.length} hitos viables`}
          </p>
        </div>
      </div>

      {/* Gráfico SVG de Proyección */}
      {renderChart()}

      {/* Barra de Acciones */}
      <div className="flex items-center justify-between bg-[#0c0c0e]/40 border border-white/[0.04] p-4 rounded-2xl mb-6">
        <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Flujos de Caja e Ingresos Anuales
        </span>
        <button 
          onClick={addIncomeSource} 
          className="btn-primary flex items-center gap-1.5 py-2 px-4 shadow-[0_0_15px_rgba(245,158,11,0.05)] text-xs font-black"
        >
          <Plus className="w-4 h-4" /> Añadir Flujo de Ingreso
        </button>
      </div>

        {/* Data Grid */}
        <div className="border border-white/5 bg-[#0a0a0c] rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                        <tr className="bg-white/[0.02] border-b border-white/10 uppercase text-[10px] font-bold tracking-widest text-zinc-500">
                            <th className="p-4 sticky left-0 z-20 bg-[#0a0a0c] border-r border-white/5">Mes</th>
                            {incomes.map(inc => (
                                <th key={inc.id} className="p-4 border-r border-white/5 min-w-[170px] group/header relative">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <input 
                                                value={inc.name} 
                                                onChange={(e) => {
                                                    const n = e.target.value;
                                                    setIncomes(incomes.map(i => i.id === inc.id ? { ...i, name: n } : i));
                                                }}
                                                className="bg-transparent outline-none text-emerald-400 font-bold placeholder:text-zinc-600 w-full truncate border-b border-transparent focus:border-emerald-500/30"
                                                placeholder="Ingreso..."
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/header:opacity-100 transition-opacity duration-150">
                                            <button 
                                                onClick={() => fillIncomeYear(inc.id)}
                                                className="px-1.5 py-0.5 rounded text-[8px] font-black text-zinc-400 hover:text-amber-400 bg-white/5 hover:bg-white/10 transition-all uppercase tracking-wider font-mono"
                                                title="Clonar valor de Ene a todo el año"
                                            >
                                                Clonar Ene
                                            </button>
                                            <button onClick={() => removeIncomeSource(inc.id)} className="text-zinc-600 hover:text-red-400 p-0.5">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </th>
                            ))}
                            <th className="p-4 border-r border-white/5 min-w-[170px] text-red-400/80 group/expense relative">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold flex items-center gap-1 shrink-0">
                                        <TrendingDown className="w-3.5 h-3.5" /> Gastos Totales
                                    </span>
                                    <button 
                                        onClick={fillExpenseYear}
                                        className="opacity-0 group-hover/expense:opacity-100 px-1.5 py-0.5 rounded text-[8px] font-black text-zinc-400 hover:text-red-400 bg-white/5 hover:bg-white/10 transition-all uppercase tracking-wider font-mono shrink-0 duration-150"
                                        title="Clonar gastos de Ene a todo el año"
                                    >
                                        Clonar Ene
                                    </button>
                                </div>
                            </th>
                            <th className="p-4 border-r border-white/5">Ahorro Neto</th>
                            <th className="p-4 text-amber-500/80">Acumulado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {MONTHS.map((m, idx) => {
                            const net = calcNetSavingsMonth(idx);
                            const acc = calcAccumulated(idx);
                            return (
                                <tr key={m} className="hover:bg-white/[0.01] transition-colors group">
                                    <td className="p-4 sticky left-0 z-20 bg-[#0a0a0c] group-hover:bg-[#0c0c0e] border-r border-white/5 font-bold text-zinc-300">
                                        {m} {activeYear}
                                    </td>
                                    
                                    {incomes.map(inc => (
                                        <td key={`${inc.id}-${m}`} className="p-0 border-r border-white/5">
                                            <input 
                                                type="number"
                                                value={inc.values[idx] === 0 ? "" : inc.values[idx]}
                                                onChange={(e) => updateIncomeValue(inc.id, idx, e.target.value)}
                                                className="w-full h-full min-h-[50px] bg-transparent outline-none px-4 text-emerald-300 hover:bg-white/5 focus:bg-white/10 rounded transition-colors hide-arrows font-mono font-bold"
                                                placeholder="-"
                                            />
                                        </td>
                                    ))}

                                    <td className="p-0 border-r border-white/5">
                                        <input 
                                            type="number"
                                            value={expenses[idx] === 0 ? "" : expenses[idx]}
                                            onChange={(e) => updateExpenseValue(idx, e.target.value)}
                                            className="w-full h-full min-h-[50px] bg-transparent outline-none px-4 text-red-300 hover:bg-white/5 focus:bg-white/10 rounded transition-colors hide-arrows font-mono font-bold"
                                            placeholder="-"
                                        />
                                    </td>
                                    
                                    <td className={cn("p-4 font-bold border-r border-white/5 font-mono", net >= 0 ? "text-emerald-400" : "text-red-400")}>
                                        {net > 0 ? "+" : ""}{formatCurrency(net)}
                                    </td>
                                    
                                    <td className={cn("p-4 font-black bg-gradient-to-r from-transparent to-white/[0.01] font-mono", acc >= 0 ? "text-amber-400" : "text-red-400")}>
                                        {formatCurrency(acc)}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-white/[0.03] border-t-2 border-white/10 font-bold text-zinc-300">
                            <td className="p-4 sticky left-0 z-20 bg-[#0a0a0c] border-r border-white/5 font-black uppercase text-[10px] tracking-wider text-zinc-400">
                                Total Anual
                            </td>
                            {incomes.map(inc => {
                                const total = inc.values.reduce((a, b) => a + b, 0);
                                return (
                                    <td key={`total-${inc.id}`} className="p-4 border-r border-white/5 font-mono font-black text-emerald-400">
                                        {formatCurrency(total)}
                                    </td>
                                );
                            })}
                            <td className="p-4 border-r border-white/5 font-mono font-black text-red-400">
                                {formatCurrency(expenses.reduce((a, b) => a + b, 0))}
                            </td>
                            <td className={cn("p-4 border-r border-white/5 font-mono font-black", 
                                MONTHS.reduce((acc, _, idx) => acc + calcNetSavingsMonth(idx), 0) >= 0 ? "text-emerald-400" : "text-red-400"
                            )}>
                                {formatCurrency(MONTHS.reduce((acc, _, idx) => acc + calcNetSavingsMonth(idx), 0))}
                            </td>
                            <td className={cn("p-4 font-mono font-black bg-gradient-to-r from-transparent to-white/[0.01]", calcAccumulated(11) >= 0 ? "text-amber-400" : "text-red-400")}>
                                {formatCurrency(calcAccumulated(11))}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            {/* SECTION HITOS */}
            <div className="bg-[#0c0c0e]/30 pt-6 pb-8 border-t border-white/[0.05] rounded-b-2xl">
                <div className="px-5 py-3 flex items-center justify-between mb-4">
                     <h3 className="text-xs font-black text-zinc-300 uppercase tracking-widest flex items-center gap-2 select-none">
                        <CalendarDays className="w-4 h-4 text-amber-500" /> Línea de Hitos (Milestones)
                     </h3>
                     <button 
                        onClick={addMilestone} 
                        className="btn-primary text-xs py-1.5 px-3 shadow-[0_0_10px_rgba(245,158,11,0.05)] font-black"
                     >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Añadir Hito
                     </button>
                </div>
                
                <div className="space-y-4 px-5">
                    {milestones.length === 0 ? (
                        <p className="text-xs text-zinc-600 italic px-2">Sin hitos definidos para este año.</p>
                    ) : milestones.map((m) => {
                        const span = (m.endMonth >= m.startMonth ? m.endMonth - m.startMonth : 0) + 1;
                        const accAtEnd = calcAccumulated(m.endMonth);
                        const isFeasible = accAtEnd >= m.amount;

                        return (
                            <div key={m.id} className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 lg:gap-0 w-full relative group items-center bg-black/20 border border-white/[0.02] hover:border-white/[0.04] p-4 lg:p-0 lg:border-none lg:bg-transparent rounded-xl transition-all">
                                 {/* Sidebar controls for the milestone */}
                                 <div className="flex flex-col gap-2 pr-4 lg:border-r lg:border-white/5 py-1 select-none">
                                     <div className="flex items-center justify-between gap-2">
                                         <input 
                                             value={m.name} 
                                             onChange={(e) => updateMilestone(m.id, { name: e.target.value })}
                                             className="w-full bg-transparent outline-none text-zinc-200 hover:bg-white/5 focus:bg-white/10 rounded px-2 py-0.5 font-extrabold text-sm border-b border-transparent focus:border-amber-500/30 transition-all"
                                             placeholder="Nombre del hito..."
                                         />
                                         <button 
                                            onClick={() => removeMilestone(m.id)} 
                                            className="text-zinc-600 hover:text-red-400 p-1 rounded hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all shrink-0 active:scale-90"
                                            title="Eliminar hito"
                                         >
                                            <Trash2 className="w-3.5 h-3.5" />
                                         </button>
                                     </div>
                                     <div className="flex items-center gap-2">
                                        <div className="relative flex items-center w-1/2">
                                            <span className="absolute left-2 text-[10px] font-black text-zinc-500">$</span>
                                            <input 
                                                type="number"
                                                value={m.amount === 0 ? "" : m.amount}
                                                onChange={(e) => updateMilestone(m.id, { amount: Number(e.target.value) || 0 })}
                                                className="w-full bg-white/5 border border-white/5 rounded pl-4 pr-1 py-1 text-xs text-zinc-300 font-mono font-bold outline-none focus:bg-white/10 focus:border-amber-500/30 transition-all hide-arrows"
                                                placeholder="Costo"
                                            />
                                        </div>
                                        <div className="flex items-center w-1/2 rounded bg-white/5 border border-white/5 overflow-hidden">
                                            <select 
                                                value={m.startMonth} 
                                                onChange={(e) => updateMilestone(m.id, { startMonth: Number(e.target.value) })} 
                                                className="w-1/2 bg-transparent text-[10px] font-bold text-zinc-400 p-1 outline-none appearance-none text-center border-r border-white/5 cursor-pointer hover:bg-white/5"
                                            >
                                                {MONTHS.map((mo, i) => <option key={mo+i} value={i} className="bg-zinc-950 text-zinc-300">{mo}</option>)}
                                            </select>
                                            <select 
                                                value={m.endMonth} 
                                                onChange={(e) => updateMilestone(m.id, { endMonth: Number(e.target.value) })} 
                                                className="w-1/2 bg-transparent text-[10px] font-bold text-zinc-400 p-1 outline-none appearance-none text-center cursor-pointer hover:bg-white/5"
                                            >
                                                {MONTHS.map((mo, i) => <option key={mo+i} value={i} className="bg-zinc-950 text-zinc-300">{mo}</option>)}
                                            </select>
                                        </div>
                                     </div>
                                 </div>
 
                                 {/* The visual block */}
                                 <div className="relative flex h-14 items-center pl-0 lg:pl-4">
                                     {/* Background guides */}
                                     <div className="grid grid-cols-12 w-full absolute inset-0 pointer-events-none hidden lg:grid">
                                        {MONTHS.map((_, i) => <div key={i} className={cn("border-l border-white/5", i===0 && "border-transparent")} />)}
                                     </div>
                                     
                                     <div 
                                        className={cn(
                                            "h-10 rounded-xl border flex flex-col justify-center px-4 relative overflow-hidden transition-all shadow-lg cursor-default select-none w-full lg:w-auto",
                                            isFeasible 
                                                ? "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-orange-500/10 border-amber-500/20 text-amber-400 hover:border-amber-500/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.08)]" 
                                                : "bg-gradient-to-r from-red-500/10 via-red-500/5 to-rose-500/10 border-red-500/20 text-red-400 hover:border-red-500/40 hover:shadow-[0_0_15px_rgba(239,68,68,0.08)]"
                                        )}
                                        style={{
                                             gridColumnStart: m.startMonth + 1,
                                             gridColumnEnd: `span ${span}`,
                                             display: "grid"
                                        }}
                                     >
                                        <div className="flex items-center justify-between gap-3 z-10 w-full overflow-hidden">
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-extrabold text-xs truncate leading-normal">{m.name}</span>
                                                <span className="text-[8px] font-black tracking-wider uppercase opacity-60 truncate">
                                                    {isFeasible 
                                                        ? `Viable • Costo: ${formatCurrency(m.amount)} (Proyectado: ${formatCurrency(accAtEnd)})` 
                                                        : `Faltan: ${formatCurrency(m.amount - accAtEnd)} (Requerido: ${formatCurrency(m.amount)} • Proyectado: ${formatCurrency(accAtEnd)})`
                                                    }
                                                </span>
                                            </div>
                                            {isFeasible ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                                            ) : (
                                                <span className="text-[8px] text-red-400 uppercase font-black bg-red-500/20 border border-red-500/20 px-1.5 py-0.5 rounded shrink-0 select-none tracking-widest font-mono">INSOLVENTE</span>
                                            )}
                                        </div>
                                     </div>
                                 </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

    </div>
  );
}
