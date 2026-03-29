"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useUid } from "@/lib/hooks/useAuth";
import { PiggyBank, Plus, Save, Trash2, CalendarDays, TrendingUp, TrendingDown, GripHorizontal } from "lucide-react";
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

  const addMilestone = () => {
    setMilestones([...milestones, { id: crypto.randomUUID(), name: "Nuevo hito", amount: 0, startMonth: 0, endMonth: 0 }]);
  };

  const updateMilestone = (id: string, updates: Partial<PlanMilestone>) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };
  const removeMilestone = (id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
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

        {/* Excel-like Table Header */}
        <div className="border border-white/5 bg-[#0a0a0c] rounded-2xl overflow-hidden shadow-2xl">
            {/* Scrollable Container */}
            <div className="overflow-x-auto custom-scrollbar">
                <div className="min-w-[1400px] text-sm">
                    
                    {/* Headers */}
                    <div className="grid grid-cols-[200px_repeat(12,1fr)] border-b border-white/10 bg-white/[0.02]">
                        <div className="p-3 font-semibold text-zinc-400 border-r border-white/5 flex flex-col justify-center">
                            <span className="text-xs">Ahorro Actual (Inicial)</span>
                            <input 
                                type="number"
                                value={initialSavings === 0 ? "" : initialSavings}
                                onChange={(e) => setInitialSavings(Number(e.target.value) || 0)}
                                className="mt-1 w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500 hide-arrows"
                                placeholder="0"
                            />
                        </div>
                        {MONTHS.map((m, idx) => (
                            <div key={m} className={cn("px-1 py-3 font-bold text-center border-r border-white/5 border-dashed flex items-center justify-center", idx === 11 && "border-r-0")}>
                                <div className="text-zinc-300">{m}</div>
                            </div>
                        ))}
                    </div>

                    {/* INCOMES SECTION */}
                    <div className="border-b border-white/10 bg-black/20">
                        <div className="px-3 py-2 flex items-center justify-between text-xs font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/5">
                            <span className="flex items-center gap-2"><TrendingUp className="w-3 h-3" /> Fuentes de Ingreso</span>
                            <button onClick={addIncomeSource} className="hover:text-emerald-300 flex items-center gap-1.5"><Plus className="w-3 h-3" /> Fila</button>
                        </div>
                        
                        {incomes.map((inc) => (
                            <div key={inc.id} className="grid grid-cols-[200px_repeat(12,1fr)] border-b border-white/5 last:border-0 group hover:bg-white/[0.01] transition-colors">
                                <div className="p-3 border-r border-white/5 flex items-center gap-2">
                                    <button onClick={() => removeIncomeSource(inc.id)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                    <input 
                                        value={inc.name} 
                                        onChange={(e) => {
                                            const n = e.target.value;
                                            setIncomes(incomes.map(i => i.id === inc.id ? { ...i, name: n } : i));
                                        }}
                                        className="w-full bg-transparent outline-none text-zinc-300 font-medium placeholder:text-zinc-600"
                                        placeholder="Nombre..."
                                    />
                                </div>
                                {MONTHS.map((_, idx) => (
                                    <div key={idx} className={cn("p-2 border-r border-white/5 border-dashed", idx === 11 && "border-r-0")}>
                                        <input 
                                            type="number"
                                            value={inc.values[idx] === 0 ? "" : inc.values[idx]}
                                            onChange={(e) => updateIncomeValue(inc.id, idx, e.target.value)}
                                            className="w-full h-full bg-transparent outline-none text-center text-zinc-400 hover:bg-white/5 focus:bg-white/10 focus:text-white rounded transition-colors hide-arrows text-[13px]"
                                            placeholder="-"
                                        />
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* TOTAL INCOME (Calculated) */}
                    <div className="grid grid-cols-[200px_repeat(12,1fr)] border-b border-emerald-500/20 bg-emerald-500/[0.02]">
                        <div className="p-3 font-bold text-emerald-400 border-r border-white/5 text-right flex items-center justify-end pr-5 text-[13px]">
                            Total Ingresos
                        </div>
                        {MONTHS.map((_, idx) => (
                            <div key={idx} className={cn("px-1 py-3 border-r border-white/5 border-dashed flex items-center justify-center font-bold text-[13px] text-emerald-300", idx === 11 && "border-r-0")}>
                                {formatCurrency(calcTotalIncome(idx))}
                            </div>
                        ))}
                    </div>

                    {/* EXPENSES SECTION */}
                    <div className="border-b border-white/10 bg-black/20">
                        <div className="px-3 py-2 flex items-center justify-between text-xs font-bold text-red-500 uppercase tracking-widest bg-red-500/5">
                            <span className="flex items-center gap-2"><TrendingDown className="w-3 h-3" /> Gastos y Egresos</span>
                        </div>
                        <div className="grid grid-cols-[200px_repeat(12,1fr)] border-b border-white/5">
                            <div className="p-3 border-r border-white/5 flex items-center font-medium text-zinc-300 pl-8">
                                Gastos Totales
                            </div>
                            {MONTHS.map((_, idx) => (
                                <div key={idx} className={cn("p-2 border-r border-white/5 border-dashed", idx === 11 && "border-r-0")}>
                                    <input 
                                        type="number"
                                        value={expenses[idx] === 0 ? "" : expenses[idx]}
                                        onChange={(e) => updateExpenseValue(idx, e.target.value)}
                                        className="w-full h-full bg-transparent outline-none text-center text-red-300 hover:bg-white/5 focus:bg-white/10 focus:text-red-400 rounded transition-colors hide-arrows text-[13px] font-medium"
                                        placeholder="-"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* NET SAVINGS PER MONTH */}
                    <div className="grid grid-cols-[200px_repeat(12,1fr)] border-b border-white/10 bg-white/[0.02]">
                        <div className="p-3 font-bold text-zinc-300 border-r border-white/5 text-right flex items-center justify-end pr-5 text-[13px]">
                            Ahorro Neto Mes
                        </div>
                        {MONTHS.map((_, idx) => {
                            const net = calcNetSavingsMonth(idx);
                            return (
                                <div key={idx} className={cn("px-1 py-3 border-r border-white/5 border-dashed flex items-center justify-center font-bold text-[13px]", idx === 11 && "border-r-0", net >= 0 ? "text-zinc-300" : "text-red-400")}>
                                    {net > 0 ? "+" : ""}{formatCurrency(net)}
                                </div>
                            )
                        })}
                    </div>

                    {/* ACCUMULATED SAVINGS (Main row) */}
                    <div className="grid grid-cols-[200px_repeat(12,1fr)] bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b-2 border-amber-500/30">
                        <div className="p-3 font-black text-amber-400 border-r border-white/10 flex items-center gap-2 text-[13px] sm:text-sm">
                            <GripHorizontal className="w-4 h-4 shrink-0" /> Ahorro Acumulado
                        </div>
                        {MONTHS.map((_, idx) => {
                            const acc = calcAccumulated(idx);
                            return (
                                <div key={idx} className={cn("px-1 py-4 border-r border-white/10 border-dashed flex items-center justify-center font-black", idx === 11 && "border-r-0")}>
                                    <span className={cn("truncate", acc >= 0 ? "text-amber-400 text-[14px]" : "text-red-400 text-[13px]")}>{formatCurrency(acc)}</span>
                                </div>
                            )
                        })}
                    </div>

                    {/* MILESTONES SECTION */}
                    <div className="bg-black/40 pt-4 pb-8">
                        <div className="px-5 py-3 flex items-center justify-between mb-2">
                             <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-amber-500" /> Línea de Hitos (Milestones)
                             </h3>
                             <button onClick={addMilestone} className="btn-secondary text-xs py-1.5 px-3">
                                <Plus className="w-3.5 h-3.5 mr-1" /> Añadir Hito
                             </button>
                        </div>
                        
                        <div className="space-y-3 px-4">
                            {milestones.length === 0 ? (
                                <p className="text-xs text-zinc-600 italic px-2">Sin hitos definidos para este año.</p>
                            ) : milestones.map((m) => {
                                // Calculate grid columns based on startMonth and endMonth
                                const startCol = m.startMonth + 2; // +1 for 1-based index, +1 for the first 200px column
                                const span = (m.endMonth >= m.startMonth ? m.endMonth - m.startMonth : 0) + 1;
                                const accAtEnd = calcAccumulated(m.endMonth);
                                const isFeasible = accAtEnd >= m.amount;

                                return (
                                    <div key={m.id} className="grid grid-cols-[200px_repeat(12,1fr)] gap-0 w-full relative group">
                                         {/* Sidebar controls for the milestone */}
                                         <div className="flex flex-col gap-1 pr-4">
                                             <div className="flex items-center justify-between gap-1">
                                                 <input 
                                                     value={m.name} 
                                                     onChange={(e) => updateMilestone(m.id, { name: e.target.value })}
                                                     className="w-full bg-transparent outline-none text-zinc-300 font-bold text-sm"
                                                     placeholder="Nombre..."
                                                 />
                                                 <button onClick={() => removeMilestone(m.id)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5"/></button>
                                             </div>
                                             <div className="flex items-center gap-1">
                                                <input 
                                                    type="number"
                                                    value={m.amount === 0 ? "" : m.amount}
                                                    onChange={(e) => updateMilestone(m.id, { amount: Number(e.target.value) || 0 })}
                                                    className="w-1/2 bg-white/5 rounded px-2 py-1 text-xs text-zinc-300 outline-none focus:bg-white/10 hide-arrows"
                                                    placeholder="Costo"
                                                />
                                                <div className="flex items-center w-1/2 rounded bg-white/5 overflow-hidden">
                                                    <select value={m.startMonth} onChange={(e) => updateMilestone(m.id, { startMonth: Number(e.target.value) })} className="w-1/2 bg-transparent text-[10px] text-zinc-400 p-1 outline-none appearance-none text-center border-r border-white/10">
                                                        {MONTHS.map((mo, i) => <option key={mo+i} value={i} className="bg-zinc-900">{mo}</option>)}
                                                    </select>
                                                    <select value={m.endMonth} onChange={(e) => updateMilestone(m.id, { endMonth: Number(e.target.value) })} className="w-1/2 bg-transparent text-[10px] text-zinc-400 p-1 outline-none appearance-none text-center">
                                                        {MONTHS.map((mo, i) => <option key={mo+i} value={i} className="bg-zinc-900">{mo}</option>)}
                                                    </select>
                                                </div>
                                             </div>
                                         </div>

                                         {/* The visual block */}
                                         <div className="col-span-12 relative flex">
                                             {/* Background guides */}
                                             <div className="grid grid-cols-12 w-full absolute inset-0 pointer-events-none">
                                                {MONTHS.map((_, i) => <div key={i} className={cn("border-l border-white/5", i===0 && "border-transparent")} />)}
                                             </div>
                                             
                                             <div 
                                                className={cn(
                                                    "h-full mt-1 mb-1 rounded-xl border flex flex-col justify-center px-4 relative overflow-hidden transition-all shadow-lg",
                                                    isFeasible ? "bg-amber-500/10 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]" : "bg-red-500/10 border-red-500/30"
                                                )}
                                                style={{
                                                     gridColumnStart: m.startMonth + 1,
                                                     gridColumnEnd: `span ${span}`,
                                                     display: "grid" // We override display just for the specific column span placement
                                                }}
                                             >
                                                <div className="flex items-center justify-between z-10">
                                                    <span className={cn("font-bold text-sm whitespace-nowrap", isFeasible ? "text-amber-400" : "text-red-400")}>{m.name}</span>
                                                    <span className={cn("font-black text-sm whitespace-nowrap ml-4", isFeasible ? "text-amber-500" : "text-red-500")}>{formatCurrency(m.amount)}</span>
                                                </div>
                                                <div className="flex justify-between mt-1 z-10">
                                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{MONTHS[m.startMonth]} - {MONTHS[m.endMonth]}</span>
                                                    {!isFeasible && <span className="text-[10px] text-red-500 uppercase font-bold bg-red-500/10 px-1 rounded">INSOLVENTE</span>}
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
        </div>

    </div>
  );
}
